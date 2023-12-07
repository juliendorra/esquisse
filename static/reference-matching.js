import { getGroupFromName } from "./group-utils.js";

import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";
import { displayAlert } from "./ui-utils.js";

export { getReferencedGroupNamesFromDataText, getReferencedResultsAndCombinedDataWithResults };

const REFERENCE_MATCHING_REGEX = /#([\w-.]+)|(?:\[)([^\]]+)(?:\])/gi;

function getReferencedGroupNamesFromDataText(data) {

    let matches = [];

    const regex = REFERENCE_MATCHING_REGEX;

    for (const match of data.matchAll(regex)) {
        if (match[1]) matches.push(match[1]);
        else if (match[2]) matches.push(match[2]);
    }

    return matches;
}

function replaceThisGroupReferenceWithResult(name, data, groups) {
    // Validate the name to ensure it conforms to the allowed format
    if (!/^[\w\s-.]+$/.test(name)) {
        console.error('[REFERENCE MATCHING] Invalid name format');
        return data; // return the original data if the name format is invalid
    }

    // Escape special regex characters in the name
    const escapedName = name.replace(/([.*+?^${}()|\[\]\\])/g, '\\$&');

    // Fetch the group using the given name and check its validity
    const referencedGroup = getGroupFromName(name, groups);
    if (!referencedGroup || referencedGroup.result === undefined) {
        console.error('[REFERENCE MATCHING] Invalid group or result');
        return data; // return the original data if the group or result is invalid
    }

    // Create regex patterns for the name with and without spaces
    const targetPatternBracket = new RegExp(`\\[${escapedName}\\]`, 'g');
    const targetPatternHash = /\s/.test(name) ? null : new RegExp(`#${escapedName}(?!\\w)`, 'g');

    let replacedData = data;

    // Replace each match of targetPatternBracket in data
    replacedData = replacedData.replace(targetPatternBracket, () => referencedGroup.result);

    // If the name does not contain spaces, replace each match of targetPatternHash in data
    if (targetPatternHash) {
        replacedData = replacedData.replace(targetPatternHash, () => referencedGroup.result);
    }

    return replacedData;
}

function getReferencedResultsAndCombinedDataWithResults(dataText, currentGroupName, groups) {

    const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(dataText);

    let hasReferences = namesOfAllGroupsReferencedByThisGroup && namesOfAllGroupsReferencedByThisGroup.length > 0;

    let invalidReferencedResults = []; // [name, ...]
    let notreadyReferencedResults = []; // [name, ...]
    let availableReferencedResults = []; //[{ name, result },..} 

    let combinedReferencedResults = dataText;

    if (hasReferences) {

        const currentGroup = getGroupFromName(currentGroupName, groups);

        for (const name of namesOfAllGroupsReferencedByThisGroup) {
            const referencedGroup = getGroupFromName(name, groups);

            if (!referencedGroup) {
                console.log(`[REFERENCE MATCHING] Trying to show reference but no group "${name}" found`);

                displayAlert(
                    {
                        issue: `No group "${name}" found`,
                        action: `Fix the reference in "${currentGroupName}"`,
                        variant: "warning",
                        icon: "question-circle",
                        duration: 3000
                    }
                );

                invalidReferencedResults.push(name);
                continue;
            }

            // The referenced group exists and is used by the current group
            // We update the inverse reference graph
            updateReferenceGraph(groups)

            const hasDirectCircularReference = referencesGraph.IS_USED_BY_GRAPH.hasEdge(referencedGroup.id, currentGroup.id) && referencesGraph.IS_USED_BY_GRAPH.hasEdge(currentGroup.id, referencedGroup.id);
            const isSelfReference = referencedGroup.id === currentGroup.id;

            if (hasDirectCircularReference || isSelfReference) {
                console.log(`[REFERENCE MATCHING] Direct circular reference between ${currentGroupName} and ${name}`);

                displayAlert(
                    {
                        issue: `Circular reference between "${currentGroupName}" and "${name}"`,
                        action: "Remove circular references",
                        variant: "warning",
                        icon: "arrow-repeat",
                        duration: 3000
                    }
                );

                invalidReferencedResults.push(name);
                continue;
            }

            if (!referencedGroup.result) {
                console.log(`[REFERENCE MATCHING] The result for "${name}" is not existing, and can't be used by group "${currentGroupName}" when trying to get referenced results`);

                notreadyReferencedResults.push(name);
                continue;
            }

            combinedReferencedResults = replaceThisGroupReferenceWithResult(name, combinedReferencedResults, groups);

            availableReferencedResults.push({ name, result: referencedGroup.result });
        }
    }


    return { hasReferences: hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults, combinedReferencedResults };
}
