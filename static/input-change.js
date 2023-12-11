import { GROUP_TYPE, getGroupIdFromElement } from "./group-utils.js";
import { updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, groupsMap } from "./group-management.js"
import { getReferencedResultsAndCombinedDataWithResults } from "./reference-matching.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";
import { persistGroups } from "./persistence.js";
import { SETTINGS } from "./app.js";
import { displayAlert } from "./ui-utils.js";


export { handleInputChange, nameChangeHandler, handleImportedImage, handleDroppedImage };

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

        console.log(`[NAME CHANGED] Group "${group.name}" name will now be: ${group.name}`);

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

    const { hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(data, group.name, groups);

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

            const downloadButton = groupElement.querySelector(".download-btn");
            downloadButton.style.display = "block";
            downloadButton.href = blobUrl;

            let fileExtension = 'png';
            if (contentType === 'image/jpeg') {
                fileExtension = 'jpeg';
            } else if (contentType === 'image/png') {
                fileExtension = 'png';
            }

            const fileName = `${group.name} — ${group.combinedReferencedResults} ${group.transform} — ${randomInt(1, 99999)}.${fileExtension} `.replace(/\s+/g, ' ').trim();

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

// Imported image groups

function handleImportedImage(event, resultImage, group, groups) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = e => {
        const file = e.currentTarget.files[0];
        const reader = new FileReader();
        reader.onload = function (event) {
            const blobUrl = URL.createObjectURL(file);
            resultImage.src = blobUrl;
            resultImage.style.display = 'block';

            // Event listener for image click to toggle zoom in and out
            resultImage.removeEventListener('click', createZoomedImage);
            resultImage.addEventListener('click', createZoomedImage);

            group.result = file; // Set the file as the result of the block
            persistGroups(groups); // Persist the groups with the new image result
        };
        reader.readAsDataURL(file);
    };
    fileInput.click();
}

function handleDroppedImage(imageFile, groupElement, groups) {

    const group = groups.get(getGroupIdFromElement(groupElement));

    const resultElement = groupElement.querySelector(".result");

    const blobUrl = URL.createObjectURL(imageFile);

    console.log("TEST DISPLAYING IMAGE")

    resultElement.src = blobUrl;
    resultElement.style.display = 'block';

    // Event listener for image click to toggle zoom in and out
    resultElement.removeEventListener('click', createZoomedImage);
    resultElement.addEventListener('click', createZoomedImage);

    group.result = imageFile;
    persistGroups(groups);
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
