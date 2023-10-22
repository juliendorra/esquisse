import { GROUP_TYPE, getGroupIdFromElement, getGroupElementFromId } from "./grouputils.js";
import { updateGroupsReferencingIt, displayCombinedReferencedResult } from "./groupmanagement.js"
import { getReferencedResultsAndCombinedDataWithResults } from "./referencematching.js";
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

    const { hasReferences, referencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(data, group.name, groups);

    // if there's references, display them and use the combination of all references as currentData
    if (referencedResults.length > 0) {
        displayCombinedReferencedResult(groupElement, combinedReferencedResults);

        // check if the new combined results from references is different from the previous combination
        currentData = combinedReferencedResults;
        referencedResultsChanged = currentData !== group.combinedReferencedResults;
        group.combinedReferencedResults = currentData;
    }

    // we do nothing more if no change and not an explicit refresh request
    if (!isRefresh
        && group.data === data
        && group.transform === transform
        && !referencedResultsChanged
    ) {
        console.log("No value changed, aborting input change");
        return;
    }

    if (group.type === GROUP_TYPE.STATIC) {
        console.log(`[COMBINING] statict text ||| ${currentData}`);

        group.result = combinedReferencedResults;

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
    const dataReadyToSend = !hasReferences && currentData || referencedResults.length > 0;

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
                        resolve(base64data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);

                    groupElement.classList.remove("waiting")
                    removeGlobalWaitingIndicator();

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

        //Automatically deduplicate block names: add number like in Finder. Starts at 2. 
        let baseName = groupNameElement.value.trim();
        let finalName = baseName;
        let counter = 2;

        // Convert the base name to lowercase for case-insensitive comparison
        const baseNameLower = baseName.toLowerCase();

        while (Array.from(groups.values()).some(g => g.name.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${baseName} ${counter}`;
            counter++;
        }

        group.name = finalName;

        groupNameElement.value = finalName;

        // if this is the first group, rename the page using its new name
        if (group.id === groups.keys().next().value) {
            document.title = `${group.name} · Esquisse AI`;
        }

        console.log(`Group ${groupNameElement} name now:${group.name}`);

        // update the groups using the new name in their reference
        updateGroupsReferencingIt(group.id, groups);

        persistGroups(groups);
    };
}


function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}