import { GROUP_TYPE, getGroupIdFromElement, getGroupElementFromId } from "./grouputils.js";
import { updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText } from "./groupmanagement.js"
import { getReferencedResultsAndCombinedDataWithResults } from "./referencematching.js";
import { referencesGraph, updateReferenceGraph } from "./referencegraphmanagement.js";
import { persistGroups } from "./persistence.js";
import { SETTINGS } from "./app.js";

export { handleInputChange, nameChangeHandler };

const DELAY = 5000;

let REQUEST_QUEUE = {};

function removeGlobalWaitingIndicator() {

    const waitingGroups = document.querySelector(".group.waiting");

    if (!waitingGroups) {
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");

        fetchingIndicatorElement.classList.remove("waiting");
    }
}


async function handleInputChange(groupElement, immediate = false, isRefresh = false, isUndirected = true, groups) {

    const group =
        groups.get(
            getGroupIdFromElement(groupElement)
        );

    if (group.type === GROUP_TYPE.BREAK) return;

    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");
    const data = dataElement.value;
    const transform = transformElement?.value || "";

    let currentData = data;
    let referencedResultsChanged = false;

    const { hasReferences, invalidReferencedResults, notreadyReferencedResults, availableReferencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(data, group.name, groups);

    // we brute force rebuild the whole graph, in case the user changed the references
    // wasteful but will make sure we don't miss any added or deleted reference
    updateReferenceGraph(groups);

    // if there's references, display them and use the combination of all references as currentData
    if (availableReferencedResults.length > 0) {
        displayCombinedReferencedResult(groupElement, combinedReferencedResults);

        // check if the new combined results from references is different from the previous combination
        currentData = combinedReferencedResults;
        referencedResultsChanged = currentData !== group.combinedReferencedResults;
        group.combinedReferencedResults = currentData;
    }
    else {
        displayDataText(groupElement);
    }

    // we do nothing more if no change and not an explicit refresh request
    if (!isRefresh
        && group.data === currentData
        && group.transform === transform
        && !referencedResultsChanged
    ) {
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

        if (isUndirected) updateGroupsReferencingIt(group.id, groups);
    }

    group.data = data;
    group.transform = transform;
    persistGroups(groups);

    const lastTransformValue = transform;

    const hasInvalidReferencedResults = notreadyReferencedResults.length > 0 || invalidReferencedResults.length > 0;

    // Ready to send request if: it's just text. Or references exists and are all valid
    const dataReadyToSend = !hasReferences && currentData || availableReferencedResults.length > 0 && !hasInvalidReferencedResults;

    if (dataReadyToSend && lastTransformValue) {
        clearTimeout(REQUEST_QUEUE[group.name]);

        const currentTime = Date.now();

        if (currentTime - group.lastRequestTime < DELAY && !immediate) {
            const timeout = DELAY - (currentTime - group.lastRequestTime);
            console.log(`Waiting for ${timeout / 1000} seconds`);
            if (REQUEST_QUEUE[group.name]) {
                clearTimeout(REQUEST_QUEUE[group.name]);
            }
            REQUEST_QUEUE[group.name] = setTimeout(() => {
                handleInputChange(groupElement, true, isRefresh);
            }, timeout);
            return;
        }

        group.lastRequestTime = currentTime;

        const fetchOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: currentData,
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
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const resultBuffer = await response.arrayBuffer();

                console.log(`Received image result buffer`);

                const blob = new Blob([resultBuffer]);
                group.result = blob;

                const reader = new FileReader();

                return new Promise((resolve, reject) => {
                    reader.onloadend = async function () {
                        const base64data = reader.result;
                        let resultImage = groupElement.querySelector(".result");
                        if (!resultImage) {
                            resultImage = document.createElement("img");
                            resultImage.className = "result";
                            groupElement.appendChild(resultImage);
                        }
                        resultImage.style.display = "block";
                        resultImage.src = base64data;

                        groupElement.querySelector(".refresh-btn").style.display = "block";

                        const downloadButton = groupElement.querySelector(".download-btn");

                        downloadButton.style.display = "block";
                        downloadButton.href = base64data;
                        downloadButton.download = group.name + "" + randomInt(1, 99999) + ".png";

                        delete REQUEST_QUEUE[group.name];

                        groupElement.classList.remove("waiting")
                        removeGlobalWaitingIndicator();

                        resolve(base64data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                groupElement.classList.remove("waiting")
                removeGlobalWaitingIndicator();
                groupElement.classList.add("error")
                console.error(`Fetch failed: ${error}`);
            }
        } else if (group.type === GROUP_TYPE.TEXT) {
            console.log(`[REQUEST] text ||| ${currentData} ||| ${lastTransformValue}`);

            groupElement.classList.remove("error");
            groupElement.classList.add("waiting");
            const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
            fetchingIndicatorElement.classList.add("waiting");

            try {
                const response = await fetch("/chatgpt", fetchOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log(`Received result: ${result}`);

                group.result = result;
                let resultParagraph = groupElement.querySelector(".result");
                if (!resultParagraph) {
                    resultParagraph = document.createElement("p");
                    resultParagraph.className = "result";
                    groupElement.appendChild(resultParagraph);
                }
                resultParagraph.textContent = group.result;
                groupElement.querySelector(".refresh-btn").style.display = "block";

                if (isUndirected) updateGroupsReferencingIt(group.id, groups);


                delete REQUEST_QUEUE[group.name];
                groupElement.classList.remove("waiting");
                removeGlobalWaitingIndicator();

            } catch (error) {
                groupElement.classList.remove("waiting");
                removeGlobalWaitingIndicator();
                groupElement.classList.add("error");
                console.error(`Fetch failed: ${error}`);
            }
        }
    }
}

function nameChangeHandler(group, groupNameElement, groups) {
    return () => {

        const previousUsersOfThisGroup = referencesGraph.IS_USED_BY_GRAPH.adjacent(group.id);

        console.log("[NAME CHANGED] previousUsersOfThisGroup ", previousUsersOfThisGroup);

        //Automatically deduplicate block names: add number like in Finder. Starts at 2. 
        let baseName = groupNameElement.value.trim();
        let counter = 2;

        if (baseName == "") {
            baseName = group.type + "-" + group.id
        }

        let finalName = baseName;

        // convert names to lowercase for case-insensitive comparison

        while (Array.from(groups.values()).some(g => g.name.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${baseName}-${counter}`;
            counter++;
        }

        group.name = finalName;
        groupNameElement.value = finalName;

        // if this is the first group, rename the page using its new name
        if (group.id === groups.keys().next().value) {
            document.title = `${group.name} · Esquisse AI`;
        }

        console.log(`Group ${groupNameElement} name now:${group.name}`);

        // we brute force rebuild the whole graph
        // wasteful but this make sure of the graph reflecting user-facing structure
        updateReferenceGraph(groups);

        // update the groups using the new name in their reference
        updateGroupsReferencingIt(group.id, groups);

        // update the now orphans groups so they stop showing this group results
        updateGroups(previousUsersOfThisGroup, groups, false);

        persistGroups(groups);
    };
}


function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}