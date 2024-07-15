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

function replaceThisGroupReferenceWithResult(name, data, groups) {

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
    } else {
        replacedData = replacedData.replace(combinedPattern, (match) => {
            console.log("[REFERENCE MATCHING] Replace image references with IMG tags ", name, match);

            const blobUrl = referencedGroup.resultBlobURI;

            return `<img class="inline-result-image" src="${blobUrl}" data-group-reference="${name}" alt="Result from ${name}">`;
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
    let itemizedDataText = []; //[{ name, isReference, isValid, isReady, groupType, contentType, resultToInsert},..} 

    console.log(`[REFERENCE MATCHING] matching refs in group ${currentGroupName}`);

    if (hasReferences) {

        const currentGroup = getGroupFromName(currentGroupName, groups);

        let lastIndex = 0;

        for (const match of dataText.matchAll(REFERENCE_MATCHING_REGEX)) {

            const name = match[1] || match[2];

            console.log(`[REFERENCE MATCHING] in group ${currentGroupName} reference name is ${name}`);


            // we iterativeley replace each match with the result in combinedReferencedResult
            combinedReferencedResults = replaceThisGroupReferenceWithResult(name, combinedReferencedResults, groups);

            // is there some text content preceding this reference?

            const precedingText = dataText.substring(lastIndex, match.index);
            if (precedingText) {
                itemizedDataText.push({ name: `before ${name}`, isReference: false, isValid: true, isReady: true, groupType: null, contentType: "TEXT", resultToInsert: precedingText });
            }

            const referencedGroup = getGroupFromName(name, groups);

            // The reference is not corresponding to any existing group
            // we just the name as content
            // we'll use the values to render an appropriate error in the preview 

            if (!referencedGroup) {
                console.log(`[REFERENCE MATCHING] Trying to show reference but no group "${name}" found`);

                displayAlert({
                    issue: `No group "${name}" found`,
                    action: `Fix the reference in "${currentGroupName}"`,
                    variant: "warning",
                    icon: "question-circle",
                    duration: 3000
                });

                invalidReferencedResults.push(name);

                itemizedDataText.push({ name, isReference: true, isValid: false, isReady: false, groupType: null, contentType: null, resultToInsert: name });

                lastIndex = match.index + match[0].length;

                continue;
            }

            // The referenced group exists and is used by the current group
            // We update the inverse reference graph
            updateReferenceGraph(groups)

            // We identify the overall type of the content, used to render them appropriately
            let contentType;
            switch (referencedGroup.type) {

                case GROUP_TYPE.BREAK:
                    contentType = null;
                    break;

                case GROUP_TYPE.TEXT:
                    contentType = 'HTML';
                    break;

                case GROUP_TYPE.STATIC:
                    contentType = 'HTML';
                    break;

                case GROUP_TYPE.IMPORTED_IMAGE:
                    contentType = 'IMAGE'
                    break;

                case GROUP_TYPE.IMAGE:
                    contentType = 'IMAGE'
                    break;

                default:
                    contentType = null;
            }

            const hasDirectCircularReference = referencesGraph.IS_USED_BY_GRAPH.hasEdge(referencedGroup.id, currentGroup.id) &&
                referencesGraph.IS_USED_BY_GRAPH.hasEdge(currentGroup.id, referencedGroup.id);
            const isSelfReference = referencedGroup.id === currentGroup.id;

            if (hasDirectCircularReference || isSelfReference) {
                console.log(`[REFERENCE MATCHING] Direct circular reference between ${currentGroupName} and ${name}`);

                displayAlert({
                    issue: `Circular reference between "${currentGroupName}" and "${name}"`,
                    action: "Remove circular references",
                    variant: "warning",
                    icon: "arrow-repeat",
                    duration: 3000
                });

                invalidReferencedResults.push(name);

                itemizedDataText.push({ name, isReference: true, isValid: false, isReady: false, groupType: referencedGroup.type, contentType: contentType, resultToInsert: name });

                lastIndex = match.index + match[0].length;

                continue;
            }

            if (!referencedGroup.result) {
                console.log(`[REFERENCE MATCHING] The result for "${name}" is not existing, and can't be used by group "${currentGroupName}" when trying to get referenced results`);

                notreadyReferencedResults.push(name);

                itemizedDataText.push({ name, isReference: true, isValid: true, isReady: false, groupType: referencedGroup.type, contentType: contentType, Insert: name });

                lastIndex = match.index + match[0].length;

                continue;
            }

            const resultToInsert = await getResultToInsert(name, groups);

            itemizedDataText.push({ name, isReference: true, isValid: true, isReady: true, groupType: referencedGroup.type, contentType: contentType, resultToInsert });

            lastIndex = match.index + match[0].length;

            const result = getResult(name, groups);

            availableReferencedResults.push({ name, result, type: referencedGroup.type, resultHash: referencedGroup.resultHash });
        }

        // After looping over all references, check if there's text left at the end

        const remainingText = dataText.substring(lastIndex);

        if (remainingText) {
            itemizedDataText.push({ name: "closing text", isReference: false, isValid: true, isReady: true, groupType: null, contentType: "TEXT", resultToInsert: remainingText });
        }

    } else {
        if (dataText) {
            itemizedDataText.push({ name: "full text", isReference: false, isValid: true, isReady: true, groupType: null, contentType: "TEXT", resultToInsert: dataText });
        }
    }

    console.log("[REFERENCE MATCHING] itemized", itemizedDataText, " combined ", combinedReferencedResults);

    return {
        hasReferences,
        invalidReferencedResults,
        notreadyReferencedResults,
        availableReferencedResults,
        itemizedDataText,
        combinedReferencedResults
    };
}

// Utils

function getResultToInsert(name, groups) {

    const referencedGroup = getGroupFromName(name, groups);

    if (!referencedGroup || referencedGroup.result === undefined) {

        return "";
    }

    const isImageResult =
        (referencedGroup.type === GROUP_TYPE.IMAGE)
        || (referencedGroup.type === GROUP_TYPE.IMPORTED_IMAGE);

    if (!isImageResult) {
        return referencedGroup.result;
    } else {
        return referencedGroup.resultBlobURI;
    }
}

function getResult(name, groups) {

    const referencedGroup = getGroupFromName(name, groups);

    if (!referencedGroup || referencedGroup.result === undefined) {

        return "";
    }

    return referencedGroup.result;
}