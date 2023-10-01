
import Graph from "https://cdn.jsdelivr.net/npm/graph-data-structure@3.3.0/+esm";

// edge means ' uses the result of -> '
// this is graph pointing to references each group list
// pointing to groups a group depends on
let USES_RESULT_OF_GRAPH = Graph();

// edge means ' is used by -> '
// this is a reverse reference graph
// pointing to groups depending on a given group
let IS_USED_BY_GRAPH = Graph();

const GROUPS = new Map();

const DELAY = 5000;

const REFERENCE_MATCHING_REGEX = /#([\w-.]+)|(?:\[)([^\]]+)(?:\])/g;

let REQUEST_QUEUE = {};

let HAS_HASH_CHANGED_PROGRAMMATICALLY = false;

const INTERACTION_STATE = {
    OPEN: "open",
    ENTRY: "entry",
    LOCKED: "locked",
};

const GROUP_TYPE = {
    STATIC: "static",
    TEXT: "text",
    IMAGE: "image",
    BREAK: "break",
    GRID: "grid",
    IMPORT: "import",
};

// Call the init function when the page loads

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

function init() {
    loadGroups();

    window.addEventListener("hashchange", () => {
        console.log("Hash changed! Programmatically? ", HAS_HASH_CHANGED_PROGRAMMATICALLY);
        if (!HAS_HASH_CHANGED_PROGRAMMATICALLY) {
            loadGroups();
        }
        HAS_HASH_CHANGED_PROGRAMMATICALLY = false;
    });

    document
        .querySelector(".add-break-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.BREAK));

    document
        .querySelector(".add-static-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.STATIC));

    document.querySelector(".add-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT)
    );

    document.querySelector(".add-img-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMAGE)
    );


    document.body.appendChild(document.createElement("br"));
    // document.body.appendChild(THUMBNAIL_CANVAS);

}

function persistGroups() {
    const strippedGroups = Array.from(GROUPS.values()).map(({ name, data, transform, type, interactionState }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
    }));

    console.log("Persisting in URL", strippedGroups);

    const base64Groups = btoa(JSON.stringify(strippedGroups));

    HAS_HASH_CHANGED_PROGRAMMATICALLY = true;
    window.location.hash = base64Groups;

}

function loadGroups() {
    const base64Groups = window.location.hash.slice(1);

    if (!base64Groups) {
        createGroupAndAddGroupElement();
        return;
    }

    try {
        const strippedGroups = JSON.parse(atob(base64Groups));

        console.log("loading groups from hash", strippedGroups);

        GROUPS.clear();

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        strippedGroups.forEach(({ name, data, transform, type, interactionState }) => {
            const group = {
                id: generateUniqueGroupID(),
                name,
                data,
                transform,
                type: type || GROUP_TYPE.TEXT,
                result: null,
                lastRequestTime: 0,
                interactionState: interactionState || INTERACTION_STATE.OPEN,
            };

            GROUPS.set(group.id, group);
            USES_RESULT_OF_GRAPH.addNode(group.id);

            const groupElement = addGroupElement(group.type, group.id);

            const groupNameElement = groupElement.querySelector(".group-name");
            const dataElement = groupElement.querySelector(".data-text");
            const transformElement = groupElement.querySelector(".transform-text");

            // Break groups elements don't have name and data elements
            if (groupNameElement) groupNameElement.value = group.name;
            if (dataElement) dataElement.value = group.data;

            if (type === GROUP_TYPE.STATIC) {
                // If data is present, call handleInput to combine data and references into a referenceable result
                if (dataElement.value) {
                    handleInputChange(groupElement, true, false);
                }
            }

            if (group.type === GROUP_TYPE.TEXT || group.type === GROUP_TYPE.IMAGE) {

                transformElement.value = transform;

                // If data is present and transform value is present, call handleInput to try to send an immediate API request
                if (dataElement.value && transformElement.value) {
                    handleInputChange(groupElement, true, false);
                }
            }

            // setGroupInteractionState set the right UI state, 
            // using optional chaining to ignore absent inputs
            setGroupInteractionState(groupElement, group.interactionState);

        });
    } catch (error) {
        console.error("Error loading groups", error);
    }

    console.log("groups loaded: ", GROUPS);

    IS_USED_BY_GRAPH = buildReverseReferenceGraph();

}

function addGroupElement(groupType = GROUP_TYPE.TEXT, groupId) {
    const groupElement = document.createElement("div");

    groupElement.dataset.id = groupId;

    switch (groupType) {

        case GROUP_TYPE.BREAK:
            groupElement.className = "group break";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>➗</small>
                    <button class="delete-btn">&#x2715;</button>
            `;
            break;

        case GROUP_TYPE.STATIC:
            groupElement.className = "group static";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>💠</small>
                    <button class="delete-btn">&#x2715;</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <div class="function-buttons-container">
                <button class="entry-btn">📥</button>
                <button class="lock-btn">🔒</button>
                </div>
            `;
            break;

        case GROUP_TYPE.IMAGE:
            groupElement.className = "group image";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>🎨</small>
                    <button class="delete-btn">&#x2715;</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this Block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
                <div class="function-buttons-container">
                    <button class="entry-btn">📥</button>
                    <button class="lock-btn">🔒</button>
                    <button class="refresh-btn">🔄</button>
                </div>
                <img class="result">
                <a class="download-btn">⬇️</a>
            `;
            break;

        default:
            groupElement.className = "group text";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small>📝</small>
                    <button class="delete-btn">&#x2715</button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
                <div class="function-buttons-container">
                <button class="entry-btn">📥</button>
                <button class="lock-btn">🔒</button>
                <button class="refresh-btn">🔄</button>
                </div>
            `;
    }

    // Initially hide the referenced-result-text 
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    if (refResultTextarea) {
        refResultTextarea.style.display = 'none';
    }
    // Initially hide the result 
    const resultElement = groupElement.querySelector(".result");
    if (resultElement) {
        resultElement.style.display = 'none';
    }

    // Initially hide the refresh button
    const refreshButton = groupElement.querySelector(".refresh-btn");
    if (refreshButton) {
        refreshButton.style.display = 'none';
    }
    // Initially hide the download button
    const downloadButton = groupElement.querySelector(".download-btn");
    if (downloadButton) {
        downloadButton.style.display = 'none';
    }

    const container = document.querySelector(".container");
    container.appendChild(groupElement);

    addEventListenersToGroup(groupElement);
    return groupElement;
}

function createGroupAndAddGroupElement(groupType = GROUP_TYPE.TEXT) {

    const id = generateUniqueGroupID();

    const group = {
        id,
        name: groupType + "-" + id,
        data: "",
        transform: "",
        type: groupType,
        result: null,
        lastRequestTime: 0,
        interactionState: INTERACTION_STATE.OPEN,
    };

    console.log("New group:", group)

    GROUPS.set(group.id, group);
    USES_RESULT_OF_GRAPH.addNode(group.id);


    persistGroups();

    const groupElement = addGroupElement(groupType, group.id);

    const groupNameElement = groupElement.querySelector(".group-name");
    groupNameElement.value = group.name;


    return groupElement;
}

function addEventListenersToGroup(groupElement) {
    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const transformElement = groupElement.querySelector(".transform-text");

    const group = getGroupFromElement(groupElement);

    console.log("got group:", group)
    console.log("adding listener to group :", group.name)

    // Persist and handle change when a group's name, data or transform changes

    groupNameElement?.addEventListener("change", () => {

        group.name = groupNameElement.value.trim();

        console.log(`Group ${groupNameElement} name now:${group.name}`)
        persistGroups();
    });

    dataElement?.addEventListener('change',
        () => {

            handleInputChange(groupElement, true, false);

        });


    transformElement?.addEventListener("change", () => {
        handleInputChange(groupElement, true, false);
    });


    dataElement?.addEventListener("blur", () => {
        const { hasReferences, referencedResults, combinedReferencedResults } = getReferencedResults(dataElement.value, group.name);
        if (referencedResults.length > 0) {
            group.combinedReferencedResults = combinedReferencedResults;
            displayCombinedReferencedResult(groupElement, combinedReferencedResults);
        }
    });

    refResultTextarea?.addEventListener("focus", () => {
        refResultTextarea.style.display = "none";
        dataElement.style.display = "block";
        dataElement.focus();
    });

    dataElement?.addEventListener("focus", () => {
        refResultTextarea.style.display = "none";
    });



    /******** Tool buttons *************/
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement));


    groupElement.querySelector(".lock-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.LOCKED ? INTERACTION_STATE.OPEN : INTERACTION_STATE.LOCKED;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups();
    });

    groupElement.querySelector(".entry-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.OPEN : INTERACTION_STATE.ENTRY;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups();
    });


    groupElement.querySelector(".refresh-btn")?.addEventListener("click", () => handleInputChange(groupElement, true, true));


}

function deleteGroup(groupElement) {
    const id = getGroupIdFromElement(groupElement);
    const groupName = GROUPS.get(id).name

    GROUPS.delete(id);
    USES_RESULT_OF_GRAPH.removeNode(id);
    groupElement.remove();

    updateGroupsReferencingIt(id);

    persistGroups();
}

function setGroupInteractionState(groupElement, interactionState) {
    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");

    switch (interactionState) {
        case INTERACTION_STATE.OPEN:
            groupNameElement?.removeAttribute("readonly");
            dataElement?.removeAttribute("readonly");
            transformElement?.removeAttribute("readonly");
            break;
        case INTERACTION_STATE.ENTRY:
            groupNameElement?.setAttribute("readonly", "readonly");
            dataElement?.removeAttribute("readonly");
            transformElement?.setAttribute("readonly", "readonly");
            break;
        case INTERACTION_STATE.LOCKED:
            groupNameElement?.setAttribute("readonly", "readonly");
            dataElement?.setAttribute("readonly", "readonly");
            transformElement?.setAttribute("readonly", "readonly");
            break;
    }
}

async function handleInputChange(groupElement, immediate = false, isRefresh = false) {
    const group = getGroupFromElement(groupElement);
    const dataElement = groupElement.querySelector(".data-text");
    const transformElement = groupElement.querySelector(".transform-text");
    const data = dataElement.value;
    const transform = transformElement?.value || "";

    let currentData = data;
    let referencedResultsChanged = false;

    const { hasReferences, referencedResults, combinedReferencedResults } = getReferencedResults(data, group.name);

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

        updateGroupsReferencingIt(group.id);
    }

    group.data = data;
    group.transform = transform;
    persistGroups();

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
            }),
        };

        if (group.type === GROUP_TYPE.IMAGE) {

            console.log(`[REQUEST] image ||| ${currentData} ||| ${lastTransformValue}`);
            groupElement.classList.remove("error");
            groupElement.classList.add("waiting");

            try {
                const response = await fetch("/stability", fetchOptions);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const resultBuffer = await response.arrayBuffer();
                console.log(`Received image result buffer`);
                const blob = new Blob([resultBuffer]);
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
                        group.result = base64data;

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

                });
            } catch (error) {
                groupElement.classList.remove("waiting")
                groupElement.classList.add("error")
                console.error(`Fetch failed: ${error}`);
            }
        } else if (group.type === GROUP_TYPE.TEXT) {
            console.log(`[REQUEST] text ||| ${currentData} ||| ${lastTransformValue}`);

            groupElement.classList.remove("error");
            groupElement.classList.add("waiting");

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

                updateGroupsReferencingIt(group.id);
                delete REQUEST_QUEUE[group.name];
                groupElement.classList.remove("waiting");

            } catch (error) {
                groupElement.classList.remove("waiting");
                groupElement.classList.add("error");
                console.error(`Fetch failed: ${error}`);
            }
        }
    }
}

function getReferencedGroupNamesFromDataText(data) {

    let matches = [];

    const regex = REFERENCE_MATCHING_REGEX;

    for (const match of data.matchAll(regex)) {
        if (match[1]) matches.push(match[1]);
        else if (match[2]) matches.push(match[2]);
    }

    return matches;
}

function replaceThisGroupReferenceWithResult(name, data) {
    // Validate the name to ensure it conforms to the allowed format
    if (!/^[\w\s-.]+$/.test(name)) {
        console.error('Invalid name format');
        return data; // return the original data if the name format is invalid
    }

    // Escape special regex characters in the name
    const escapedName = name.replace(/([.*+?^${}()|\[\]\\])/g, '\\$&');

    // Fetch the group using the given name and check its validity
    const referencedGroup = getGroupFromName(name);
    if (!referencedGroup || referencedGroup.result === undefined) {
        console.error('Invalid group or result');
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


function getGroupIdFromElement(groupElement) {
    return groupElement.dataset.id;
}

function getGroupElementFromName(groupName) {
    console.log("Getting the element for group named", groupName)
    const container = document.querySelector(".container");
    return container.querySelector(`.group-name[value="${groupName}"]`).parentNode;
}

function getGroupElementFromId(groupId) {
    console.log("Getting the element for group of id ", groupId);
    return document.querySelector(`div[data-id="${groupId}"]`);
}


function getGroupFromElement(groupElement) {
    const groupId = getGroupIdFromElement(groupElement);

    console.log("group id found is", groupId)

    return GROUPS.get(groupId);
}

function getGroupFromName(name) {

    // will return the first group found by that name, ignore the rest

    for (const [key, group] of GROUPS) {

        if (group.name === name) {
            return group;
        }
    }
    console.log("couldn't find a group named ", name)
    return undefined
}

function generateUniqueGroupID() {
    let name = "";
    let unique = false;
    while (!unique) {
        name = `${randomInt(1, 9999)}`;
        if (!GROUPS.has(name)) {
            unique = true;
        }
    }
    return name;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


function buildReverseReferenceGraph() {

    console.log("Building the invert dependency graph from the groups structure")

    // Builds the graph of 'group as a result' =>> groups that reference them to use their result
    //
    // example:
    // group 45 uses 62 and 336's results (45 references 62 and 336 in its dataText)
    // edge will be 
    // 62-> 45, 336-> 45
    //
    // that way 62 can easily find that 45 is using its result, and notify it of changes

    const graph = Graph();

    for (const [key, group] of GROUPS) {

        graph.addNode(group.id);

        const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(group.data);

        console.log(namesOfAllGroupsReferencedByThisGroup);

        for (const referencedGroupName of namesOfAllGroupsReferencedByThisGroup) {

            const referencedGroup = getGroupFromName(referencedGroupName);

            console.log(referencedGroupName, referencedGroup)

            if (referencedGroup) {
                console.log("named reference to existing group, added to invert dependency graph", referencedGroupName, referencedGroup)

                graph.addEdge(referencedGroup.id, group.id)
            }
            else {
                console.log("named reference to unexisting group, not added to invert dependency graph", referencedGroupName)
            }
        }
    }

    console.log(graph.serialize());

    return graph;
}

async function updateGroupsReferencingIt(id) {

    // a group has changed
    // groups that reference it must be notified
    // we get the name of the group
    // we use the groups graph to find them

    const nameOfChangedGroup = GROUPS.get(id).name

    // get the list of groups that depends on the changed group in their dataText
    // precomputed in the reverse graph.

    const idsOfGroupsToUpdate = IS_USED_BY_GRAPH.adjacent(id);

    // We sort the groups to update them in topological order
    // to avoid re-updating a group that would depends on both this group and another updated group

    // The sort raise a CycleError if a cycle is found 

    let orderOfUpdate;

    try {
        orderOfUpdate = IS_USED_BY_GRAPH.topologicalSort(idsOfGroupsToUpdate)

    } catch (error) {
        console.log("[CycleError] Circular dependency between these groups:", idsOfGroupsToUpdate)
        return;
    }

    for (const id of orderOfUpdate) {

        console.log("updating the dependant group of id ", id)

        // if we don't await, a further group might launch a request when it actually depends on the previous group results
        // we stop being fully reactive and fully async here
        // and await between each steps
        // we should probably use the graph more to async everything that can

        await handleInputChange(
            getGroupElementFromId(id),
            true,
            false);

    };
}


function getReferencedResults(dataText, currentGroupName) {

    const namesOfAllGroupsReferencedByThisGroup = getReferencedGroupNamesFromDataText(dataText);

    let hasReferences = namesOfAllGroupsReferencedByThisGroup && namesOfAllGroupsReferencedByThisGroup.length > 0;

    let referencedResults = [];
    let combinedReferencedResults = dataText;

    if (hasReferences) {

        const currentGroup = getGroupFromName(currentGroupName)

        referencedResults = namesOfAllGroupsReferencedByThisGroup.map((name) => {
            const referencedGroup = getGroupFromName(name);

            if (!referencedGroup) {
                console.log(`When trying to show reference: No group found with the name ${name}`);
                return null;
            }

            // Check for direct circular references between the two groups
            // also check if it's a self reference
            if (IS_USED_BY_GRAPH.hasEdge(referencedGroup.id, currentGroup.id)
                && IS_USED_BY_GRAPH.hasEdge(currentGroup.id, referencedGroup.id)
                || referencedGroup.id === currentGroup.id) {
                console.log(`Direct circular reference between ${currentGroupName} and ${name}`);
                return null;
            }

            if (!referencedGroup.result) {
                console.log(`When trying to get referenced results: ${name}'s result is not set, and can't be used by group ${currentGroupName}`);
                return null;
            }

            // Not efficient to pass the name as we already fetched the group, 
            // ensure it exists, and that it has a result

            combinedReferencedResults = replaceThisGroupReferenceWithResult(name, combinedReferencedResults);

            return { name: name, result: referencedGroup.result };
        })
            .filter((result) => result);
    }

    return { hasReferences: hasReferences, referencedResults, combinedReferencedResults };
}

function displayCombinedReferencedResult(groupElement, combinedReferencedResults) {
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    console.log(`Displaying the group referenced result in refResultTextarea`);

    refResultTextarea.value = combinedReferencedResults ? combinedReferencedResults : "";
    refResultTextarea.style.display = "block";
    dataText.style.display = "none";

    return combinedReferencedResults;
}



