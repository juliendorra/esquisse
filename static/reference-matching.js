import { GROUP_TYPE, getGroupFromName } from "./group-utils.js";

import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";
import { displayAlert } from "./ui-utils.js";

export { getReferencedGroupNamesFromDataText, getReferencedResultsAndCombinedDataWithResults };

const REFERENCE_MATCHING_REGEX = /#([\S]+)|\[(.+?)\]/gi;

function getReferencedGroupNamesFromDataText(data) {

    let matches = [];

    const regex = REFERENCE_MATCHING_REGEX;

    for (const match of data.matchAll(regex)) {
        if (match[1]) matches.push(match[1]);
        else if (match[2]) matches.push(match[2]);
    }

    return matches;
}

async function replaceThisGroupReferenceWithResult(name, data, groups) {

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

    // check if the name of the group referenced contains whitespace. 
    // Only create Hash matching pattern if it doesn't
    // the pattern is set to null if the group name has white space, which is checked later
    const targetPatternHash = /\s/.test(name) ? null : new RegExp(`#${escapedName}(?!\\w)`, 'g');

    const combinedPattern = new RegExp(
        `${targetPatternBracket.source}${targetPatternHash ? '|' + targetPatternHash.source : ''}`,
        'g'
    );

    let replacedData = data;

    const isImageResult = referencedGroup.type === GROUP_TYPE.IMAGE || referencedGroup.type === GROUP_TYPE.IMPORTED_IMAGE;

    if (!isImageResult) {

        // Replace each match of the exact pattern 'this group name surrounded by brackets'
        replacedData = replacedData.replace(combinedPattern, () => referencedGroup.result);

    }

    if (isImageResult) {

        // Replace image result reference with IMG tag

        replacedData = replacedData.replace(combinedPattern, (match) => {
            console.log("Replace image references with IMG tags ", match);

            const blobUrl = URL.createObjectURL(referencedGroup.result);
            return `<img class="inline-result-image" src="${blobUrl}" alt="${name}">`;
        });
    }

    return replacedData;
}

async function getReferencedResultsAndCombinedDataWithResults(dataText, currentGroupName, groups) {

    const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(dataText);

    let hasReferences = namesOfAllGroupsReferencedByThisGroup && namesOfAllGroupsReferencedByThisGroup.length > 0;

    let invalidReferencedResults = []; // [name, ...]
    let notreadyReferencedResults = []; // [name, ...]
    let availableReferencedResults = []; //[{ name, result, type, resultHash },..} 

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

            combinedReferencedResults = await replaceThisGroupReferenceWithResult(name, combinedReferencedResults, groups);

            availableReferencedResults.push({ name, result: referencedGroup.result, type: referencedGroup.type, resultHash: referencedGroup.resultHash });
        }
    }


    return {
        hasReferences,
        invalidReferencedResults,
        notreadyReferencedResults,
        availableReferencedResults,
        combinedReferencedResults
    };
}

// utils

async function blobTo8charsHash(blob) {

    const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });

    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.substring(0, 8);
}
