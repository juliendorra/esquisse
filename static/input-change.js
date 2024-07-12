import { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, generateUniqueGroupName, getGroupIdFromElement } from "./group-utils.js";
import { updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, displayFormattedResults, groupsMap } from "./group-management.js"
import { getReferencedResultsAndCombinedDataWithResults } from "./reference-matching.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";
import { persistGroups, persistImage } from "./persistence.js";
import { SETTINGS } from "./app.js";
import { displayAlert, removeGlobalWaitingIndicator, createZoomedImage } from "./ui-utils.js";
import { fetchWithCheck } from "./network.js";

export {
    nameChangeHandler, handleInputChange,
    handleListSelectionChange,
    handleImportedImage, handleDroppedImage, hashAndPersist, clearImportedImage
};

function nameChangeHandler(group, groupNameElement, groups) {

    groups = groupsMap.GROUPS;

    const previousUsersOfThisGroup = referencesGraph.IS_USED_BY_GRAPH.adjacent(group.id);

    console.log(
        previousUsersOfThisGroup.length > 0 ?
            "[NAME CHANGED] previousUsersOfThisGroup were: " + previousUsersOfThisGroup
            : "[NAME CHANGED] No other group used this group"
    );

    //Automatically deduplicate block names: add number like in Finder. Starts at 2. 
    let baseName = groupNameElement.value.trim();
    let counter = 2;

    if (baseName == "") {
        baseName = generateUniqueGroupName(group.type, groups);
    }

    let finalName = baseName;

    // convert names to lowercase for case-insensitive comparison

    while (
        Array.from(
            groups.values())
            .filter(
                thisgroup => thisgroup.id !== group.id
            ).some(
                thisgroup => thisgroup.name.toLowerCase() === finalName.toLowerCase()
            )
    ) {
        finalName = `${baseName}-${counter}`;
        counter++;
    }

    console.log(`[NAME CHANGED] Group of id ${group.id}, is named "${group.name}" will be: ${finalName}`);

    group.name = finalName;

    console.log(`[NAME CHANGED] Group of id ${group.id}, is now named "${group.name}"`);

    groupNameElement.value = finalName;

    // if this is the first group, rename the page using its new name
    if (group.id === groups.keys().next().value) {
        document.title = `${group.name} · Esquisse AI`;
    }

    // save the new name
    persistGroups(groups);

    // we brute force rebuild the whole graph
    // wasteful but this make sure of the graph reflecting user-facing structure
    updateReferenceGraph(groups);

    // update the groups using the new name in their reference
    updateGroupsReferencingIt(group.id);

    if (previousUsersOfThisGroup.length > 0)
    // update the now orphans groups so they stop showing this group results
    { updateGroups(previousUsersOfThisGroup, false); }

}

async function handleInputChange(groupElement, immediate = false, isRefresh = false, isUndirected = true, groups) {

    groups = groupsMap.GROUPS;

    const group =
        groups.get(
            getGroupIdFromElement(groupElement)
        );

    if (group.type === GROUP_TYPE.BREAK) return;

    if (group.type === GROUP_TYPE.IMPORTED_IMAGE) return;

    // we brute force rebuild the whole graph, in case the user changed the references
    // wasteful but will make sure we don't miss any added or deleted reference
    updateReferenceGraph(groups);

    // Handling references: validity check, combining, displaying

    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");
    const data = dataElement?.value || "";
    const transform = transformElement?.value || "";

    let currentData = data;
    let referencedResultsChanged = false;

    const {
        hasReferences,
        invalidReferencedResults,
        notreadyReferencedResults,
        availableReferencedResults,
        combinedReferencedResults
    } = await getReferencedResultsAndCombinedDataWithResults(data, group.name, groups);

    displayDataTextReferenceStatus({ groupElement, hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults });

    group.availableReferencedResults = availableReferencedResults;

    // if there's references, display them and use the combination of all references as currentData
    if (availableReferencedResults.length > 0) {

        displayCombinedReferencedResult(groupElement, combinedReferencedResults);

        currentData = combinedReferencedResults;

        for (const referencedResult of availableReferencedResults) {

            console.log(`[COMPARING RESULT HASH] comparing result hashes for ${referencedResult.name}. 
                New hash: ${referencedResult.resultHash}
                Old hash: ${group.referenceHashes?.get(referencedResult.name)}`)

            // if there was no previous reference to this result or if the hash is different, referenced results have changed
            if (!group.referenceHashes?.get(referencedResult.name)
                || referencedResult.resultHash !== group.referenceHashes.get(referencedResult.name)) {
                referencedResultsChanged = true;
                // break early once one result has changed
                break;
            }
        }

        // Having checked for changes, we create a new map of all references hashes to keep track of future changes
        group.referenceHashes = new Map(availableReferencedResults.map(({ name, resultHash }) => [name, resultHash]));

    } else {
        displayDataText(groupElement);
    }

    group.combinedReferencedResults = currentData;

    const groups_structure_has_changed =
        (group.interactionState !== INTERACTION_STATE.ENTRY && group.data !== data)
        || group.transform !== transform;

    const groups_have_changed =
        group.data !== currentData
        || group.transform !== transform
        || referencedResultsChanged;

    console.log("groups_have_changed: ", groups_have_changed)
    console.log("groups_structure_has_changed: ", groups_structure_has_changed)

    // we do nothing more if no change and not an explicit refresh request
    if (!isRefresh && !groups_have_changed) {
        console.log("[CHANGE HANDLING] No values changed, not a manual refresh, aborting input change");
        return;
    }

    if (group.type === GROUP_TYPE.STATIC) {
        console.log(`[CHANGE HANDLING] combining statict text: ${currentData}`);

        group.result = currentData;

        if (isUndirected) updateGroupsReferencingIt(group.id);
    }

    group.data = data;
    group.transform = transform;

    group.resultHash = await generateHash(group.result);

    // If there's an image result referenced, we get it and prepare it to send in the generative request 
    let imageB64;

    for (const result of availableReferencedResults) {
        if (result.type === GROUP_TYPE.IMAGE || result.type === GROUP_TYPE.IMPORTED_IMAGE) {
            imageB64 = await fileToBase64(result.result)
            console.log("[PREPARING TO FETCH] image blob is ", imageB64)
            break;
        }
    }

    if (groups_structure_has_changed) persistGroups(groups);

    // Sending generative request for the group

    const lastTransformValue = transform;

    const hasInvalidReferencedResults = notreadyReferencedResults.length > 0 || invalidReferencedResults.length > 0;

    // Ready to send request if: it's just text. Or references exists and are all valid
    const dataReadyToSend = !hasReferences && currentData || availableReferencedResults.length > 0 && !hasInvalidReferencedResults;

    if (dataReadyToSend && lastTransformValue) {

        await sendRequestsForGroup({
            currentData,
            image: imageB64,
            lastTransformValue,
            isUndirected,
            groupElement,
            group,
            groups
        });
    }

    displayFormattedResults(groupElement);

    if (isUndirected) {
        console.log("[INPUT CHANGE] Undirected update, Now updating dataText of groups referencing results from: ", group.name)
        updateGroupsReferencingIt(group.id);
    }
}

async function sendRequestsForGroup({
    currentData,
    image,
    lastTransformValue,
    isUndirected,
    groupElement,
    group,
    groups
}
) {

    const fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            data: currentData,
            image: image,
            transform: lastTransformValue,
            qualityEnabled: SETTINGS.qualityEnabled,
            controlnetEnabled: group.controlnetEnabled,
        }),
    };

    if (group.type === GROUP_TYPE.IMAGE) {

        console.log(`[REQUEST] image ||| ${currentData} ||| ${lastTransformValue}`);

        groupElement.classList.remove("error");
        groupElement.classList.add("waiting");
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
        fetchingIndicatorElement.classList.add("waiting");

        try {
            const response = await fetchWithCheck("/stability", fetchOptions);

            if (!response.ok) {

                const errorData = await response.json();

                if (response.status === 400) {

                    displayAlert(
                        {
                            issue: `Error generating image ${group.name}`,
                            action: `Error is: ${errorData.error}`,
                            variant: "warning",
                            icon: "exclamation-octagon",
                            duration: 5000
                        }
                    );
                }

                throw new Error(`HTTP status ${response.status}, ${errorData.error}`);
            }

            const resultBuffer = await response.arrayBuffer();
            console.log(`Received image result buffer`);

            // Check for banned word
            const bannedWord = response.headers.get('x-banned-word');
            if (bannedWord) {
                displayAlert(
                    {
                        issue: `Word "${bannedWord}" removed for ${group.name}`,
                        action: `Banned by the generator, avoid it if possible`,
                        variant: "warning",
                        icon: "exclamation-octagon",
                        duration: 5000
                    }
                );
            }

            const contentType = response.headers.get('Content-Type');

            const blob = new Blob([resultBuffer], { type: contentType });
            group.result = blob;

            const blobUrl = URL.createObjectURL(blob);
            console.log("URL for the image ", blobUrl);

            group.resultBlobURI = blobUrl;

            let resultImage = groupElement.querySelector(".result");

            resultImage.style.display = "block";
            resultImage.src = blobUrl;

            // Event listener for image click to toggle zoom in and out
            resultImage.removeEventListener('click', createZoomedImage);
            resultImage.addEventListener('click', createZoomedImage);

            groupElement.querySelector(".refresh-btn").style.display = "block";

            const downloadButton = groupElement.querySelector(".download-btn");
            downloadButton.style.display = "block";
            downloadButton.href = blobUrl;

            let fileExtension = 'png';
            if (contentType === 'image/jpeg') {
                fileExtension = 'jpeg';
            } else if (contentType === 'image/png') {
                fileExtension = 'png';
            }

            const maxPromptTextLength = 240 - group.name.length - 15;

            let promptText = `${group.combinedReferencedResults} ${group.transform}`.substring(0, maxPromptTextLength);

            const fileName = `${group.name} — ${promptText} — ${randomInt(1, 99999)}.${fileExtension}`.replace(/\s+/g, ' ').trim();

            downloadButton.download = fileName;

            groupElement.classList.remove("waiting");
            removeGlobalWaitingIndicator();

        } catch (error) {
            groupElement.classList.remove("waiting");
            removeGlobalWaitingIndicator();
            groupElement.classList.add("error");
            console.error(`Fetch failed: ${error} `);
        }
    } else if (group.type === GROUP_TYPE.TEXT) {
        console.log(`[REQUEST] text ||| ${currentData} ||| ${lastTransformValue} `);

        groupElement.classList.remove("error");
        groupElement.classList.add("waiting");
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
        fetchingIndicatorElement.classList.add("waiting");

        try {
            const response = await fetchWithCheck("/chatgpt", fetchOptions);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} `);
            }

            const result = await response.json();
            console.log(`Received result: ${result} `);

            group.result = result;

            displayFormattedResults(groupElement);

            groupElement.querySelector(".refresh-btn").style.display = "block";

            groupElement.classList.remove("waiting");
            removeGlobalWaitingIndicator();

        } catch (error) {
            groupElement.classList.remove("waiting");
            removeGlobalWaitingIndicator();
            groupElement.classList.add("error");
            console.error(`Fetch failed: ${error} `);
        }
    }

}

// List selection change

function handleListSelectionChange(selectElement, group, listItems) {

    console.log(`[LIST SELECTION] group ${group.name} result is now: ${selectElement.value ? listItems[parseInt(selectElement.value)] : "a random choice"}`)

    if (!selectElement.value) {
        group.result = listItems[randomInt(0, listItems.length - 1)];
    }

    else {
        group.result = listItems[parseInt(selectElement.value)];
    }

    updateGroupsReferencingIt(group.id)
}

// Imported image groups

async function handleImportedImage(group, groupElement) {

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = async e => {
        const imageFile = e.currentTarget.files[0];
        handleDroppedImage(imageFile, groupElement);
    };
    fileInput.click();
}

async function handleDroppedImage(imageFile, groupElement) {

    const group =
        groupsMap.GROUPS.get(
            getGroupIdFromElement(groupElement)
        );

    try {
        const processedBlob = await processImage(imageFile);

        displayAndAddToGroupImportedImageBlob(groupElement, processedBlob, group);

        const previousHashImportedImage = group.hashImportedImage

        group.hashImportedImage = await hashAndPersist(group.interactionState, processedBlob);


        if (group.hashImportedImage && group.hashImportedImage !== previousHashImportedImage) {
            const groups = groupsMap.GROUPS;
            persistGroups(groups)
        }

        updateGroupsReferencingIt(group.id);

    } catch (error) {
        console.error(error);
        // Handle the error appropriately
    }
}

function displayAndAddToGroupImportedImageBlob(groupElement, processedBlob, group) {
    const resultElement = groupElement.querySelector(".result");
    const functionButtonsContainer = groupElement.querySelector(".function-buttons-container");

    const blobUrl = URL.createObjectURL(processedBlob);

    resultElement.src = blobUrl;
    resultElement.style.display = 'block';
    functionButtonsContainer.style.display = 'flex';

    group.resultBlobURI = blobUrl;

    // Event listener for image click to toggle zoom in and out
    resultElement.removeEventListener('click', createZoomedImage);
    resultElement.addEventListener('click', createZoomedImage);

    group.result = processedBlob;
}

async function hashAndPersist(interactionState, importedImageBlob) {

    let hashImportedImage;

    // We don't persist the image if the block is set as a temporary input
    if (interactionState === INTERACTION_STATE.ENTRY) {
        hashImportedImage = "";
    }
    else {
        hashImportedImage = await persistImage(importedImageBlob);
    }

    return hashImportedImage;
}

function clearImportedImage(group, groupElement) {

    const resultElement = groupElement.querySelector(".result");

    resultElement.style.display = 'none';
    resultElement.src = "";
    resultElement.removeEventListener('click', createZoomedImage);

    group.result = undefined;

    const previousHashImportedImage = group.hashImportedImage
    group.hashImportedImage = "";

    if (previousHashImportedImage) {
        const groups = groupsMap.GROUPS;
        persistGroups(groups);
    }
    updateGroupsReferencingIt(group.id);
}


// Utils

async function generateHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.replace('data:', '').replace(/^.+,/, '');
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function processImage(imageFile) {
    return new Promise((resolve, reject) => {
        // Create an image object
        const img = new Image();
        img.src = URL.createObjectURL(imageFile);

        img.onload = () => {
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate the new size
            const maxSize = 1024;
            let width, height;
            if (img.width > img.height) {
                width = maxSize;
                height = (img.height / img.width) * maxSize;
            } else {
                height = maxSize;
                width = (img.width / img.height) * maxSize;
            }

            // Set canvas size
            canvas.width = maxSize;
            canvas.height = maxSize;

            // Fill canvas with transparent background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw image in the center of the canvas
            const xOffset = (maxSize - width) / 2;
            const yOffset = (maxSize - height) / 2;
            ctx.drawImage(img, xOffset, yOffset, width, height);

            // Convert canvas to JPEG blob
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to convert canvas to blob."));
                }
            }, 'image/jpeg', 0.9);
        };

        img.onerror = () => {
            reject(new Error("Failed to load image."));
        };
    });
}