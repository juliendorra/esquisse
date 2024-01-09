import { GROUP_TYPE, RESULT_DISPLAY_FORMAT, getGroupElementFromId, getGroupIdFromElement } from "./group-utils.js";
import { updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, displayFormattedResults, groupsMap } from "./group-management.js"
import { getReferencedResultsAndCombinedDataWithResults } from "./reference-matching.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";
import { persistGroups } from "./persistence.js";
import { SETTINGS } from "./app.js";
import { displayAlert } from "./ui-utils.js";


export { nameChangeHandler, handleInputChange, handleListSelectionChange, handleImportedImage, handleDroppedImage };

const DELAY = 5000;

let REQUEST_QUEUE = {};

function nameChangeHandler(group, groupNameElement, groups) {
    return () => {

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
            baseName = group.type + "-" + group.id
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

        console.log(`[NAME CHANGED] Group "${group.name}" name will now be: ${finalName}`);

        groups.get(group.id).name = finalName;
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

    };
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

    const { hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults, combinedReferencedResults } = await getReferencedResultsAndCombinedDataWithResults(data, group.name, groups);

    displayDataTextReferenceStatus({ groupElement, hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults });

    group.availableReferencedResults = availableReferencedResults;

    // if there's references, display them and use the combination of all references as currentData
    if (availableReferencedResults.length > 0) {
        displayCombinedReferencedResult(groupElement, combinedReferencedResults);

        // check if the new combined results from references is different from the previous combination
        currentData = combinedReferencedResults;
        referencedResultsChanged = currentData !== group.combinedReferencedResults;
    }
    else {
        displayDataText(groupElement);
    }

    group.combinedReferencedResults = currentData;

    const groups_structure_has_changed =
        group.data !== data
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

        let resultParagraph = groupElement.querySelector(".result");

        if (!resultParagraph) {
            resultParagraph = document.createElement("p");
            resultParagraph.className = "result";
            groupElement.appendChild(resultParagraph);
        }

        resultParagraph.textContent = group.result;

        if (isUndirected) updateGroupsReferencingIt(group.id);
    }

    // if the text result is displayed formated ex. as a list, display the new result as formatted

    const isFormattedTextResult =
        (group.type === GROUP_TYPE.STATIC || group.type === GROUP_TYPE.TEXT)
        && group.resultDisplayFormat
        && group.resultDisplayFormat !== RESULT_DISPLAY_FORMAT.TEXT;

    if (isFormattedTextResult) {
        displayFormattedResults(groupElement);
    }

    group.data = data;
    group.transform = transform;

    let imageB64;

    for (const result of availableReferencedResults) {
        if (result.type === GROUP_TYPE.IMAGE || result.type === GROUP_TYPE.IMPORTED_IMAGE) {
            imageB64 = await fileToBase64(result.result)
            console.log("[PREPARING TO FETCH] image blob is ", imageB64)
            break;
        }
    }


    if (groups_structure_has_changed) persistGroups(groups);

    // Sending requests for the groups

    const lastTransformValue = transform;

    const hasInvalidReferencedResults = notreadyReferencedResults.length > 0 || invalidReferencedResults.length > 0;

    // Ready to send request if: it's just text. Or references exists and are all valid
    const dataReadyToSend = !hasReferences && currentData || availableReferencedResults.length > 0 && !hasInvalidReferencedResults;

    if (dataReadyToSend && lastTransformValue) {
        clearTimeout(REQUEST_QUEUE[group.id]);

        const currentTime = Date.now();

        const elapsedTime = currentTime - group.lastRequestTime;


        /////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // DEBUG ====  WE SEND **ALL** call to handleInputChanges AS IMMEDIATE REQUESTS, so this is NEVER TRUE //

        if (currentTime - group.lastRequestTime < DELAY && !immediate) {

            const timeout = DELAY - elapsedTime;

            console.log(`Waiting for ${timeout / 1000} seconds`);

            if (REQUEST_QUEUE[group.id]) {
                clearTimeout(REQUEST_QUEUE[group.id]);
            }

            REQUEST_QUEUE[group.id] = setTimeout(() => {
                handleInputChange(groupElement, true, isRefresh);
            }, timeout);

            return;
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        group.lastRequestTime = currentTime;

        // Regex pattern matching [image: Image Name de641d7c] 
        // tags inserted to indicate that an image reference has been taken into account
        // we want to remove them from the actual prompt
        const imageTagsPattern = /\[image: .* [a-fA-F0-9]{8}\]/g;

        // Replace the pattern with an empty string
        currentData = currentData.replace(imageTagsPattern, '');

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
            const response = await fetch("/stability", fetchOptions);

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

            let resultImage = groupElement.querySelector(".result");

            resultImage.style.display = "block";
            resultImage.src = blobUrl;

            // Event listener for image click to toggle zoom in and out
            resultImage.removeEventListener('click', createZoomedImage);
            resultImage.addEventListener('click', createZoomedImage);

            groupElement.querySelector(".refresh-btn").style.display = "block";

            if (isUndirected) {
                console.log("[FETCH] Undirected update, Now updating dataText of groups referencing results from: ", group.name)
                updateGroupsReferencingIt(group.id);
            }

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

            delete REQUEST_QUEUE[group.id];
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
            const response = await fetch("/chatgpt", fetchOptions);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} `);
            }

            const result = await response.json();
            console.log(`Received result: ${result} `);

            group.result = result;
            let resultParagraph = groupElement.querySelector(".result");
            if (!resultParagraph) {
                resultParagraph = document.createElement("p");
                resultParagraph.className = "result";
                groupElement.appendChild(resultParagraph);
            }
            resultParagraph.textContent = group.result;
            groupElement.querySelector(".refresh-btn").style.display = "block";

            if (isUndirected) {
                console.log("[FETCH] Undirected update, Now updating dataText of groups referencing results from: ", group.name)
                updateGroupsReferencingIt(group.id);
            }

            delete REQUEST_QUEUE[group.id];
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

async function handleImportedImage(event, resultImage, group) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = async e => {
        const file = e.currentTarget.files[0];
        try {
            const processedBlob = await processImage(file);
            resultImage.src = URL.createObjectURL(processedBlob);
            resultImage.style.display = 'block';

            // Event listener for image click to toggle zoom in and out
            resultImage.removeEventListener('click', createZoomedImage);
            resultImage.addEventListener('click', createZoomedImage);

            group.result = processedBlob; // Set the processed blob as the result of the block
            updateGroupsReferencingIt(group.id);
        } catch (error) {
            console.error(error);
            // Handle the error appropriately
        }
    };
    fileInput.click();
}

async function handleDroppedImage(imageFile, group, groupElement) {
    const resultElement = groupElement.querySelector(".result");

    try {
        const processedBlob = await processImage(imageFile);
        resultElement.src = URL.createObjectURL(processedBlob);
        resultElement.style.display = 'block';

        // Event listener for image click to toggle zoom in and out
        resultElement.removeEventListener('click', createZoomedImage);
        resultElement.addEventListener('click', createZoomedImage);

        group.result = processedBlob; // Set the processed blob as the result of the group
        updateGroupsReferencingIt(group.id);
    } catch (error) {
        console.error(error);
        // Handle the error appropriately
    }
}


// UI 

function createZoomedImage(event) {

    let clonedImage = event.currentTarget.cloneNode(true);

    clonedImage.classList.add('zoomed');

    document.body.classList.add('no-scroll');

    clonedImage.addEventListener('click',
        function (event) {
            document.body.classList.remove('no-scroll');
            clonedImage.remove();
            clonedImage = null;
        });

    document.body.appendChild(clonedImage);

}

function removeGlobalWaitingIndicator() {

    const waitingGroups = document.querySelector(".group.waiting");

    if (!waitingGroups) {
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");

        fetchingIndicatorElement.classList.remove("waiting");
    }
}

// Utils

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function fileToBase64(file) {
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

async function processImage(imageFile) {
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


