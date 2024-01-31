import { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateUniqueGroupID } from "./group-utils.js";

import Graph from "https://cdn.jsdelivr.net/npm/graph-data-structure@3.5.0/+esm";

import { displayAlert } from "./ui-utils.js";

import { nameChangeHandler, handleInputChange, handleListSelectionChange, handleImportedImage, handleDroppedImage, clearImportedImage } from "./input-change.js";
import { onDragStart, onDragEnd } from "./reordering.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";

import { persistGroups } from "./persistence.js";


const groupsMap = {
    GROUPS: new Map(),
};

// this map hold the unresolved promises 
let ONGOING_UPDATES = new Map();

export {
    groupsMap, createGroupInLocalDataStructures,
    addGroupElement, createGroupAndAddGroupElement, addEventListenersToGroup, deleteGroup, displayGroupInteractionState, displayControlnetStatus, updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, displayFormattedResults, rebuildGroupsInNewOrder
};

const GROUP_HTML = {

    BREAK: `
            <div class="group-header">
                <small><img src="/icons/break.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            `,

    STATIC: `
            <div class="group-header">
                <small><img src="/icons/text-static.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use: text, #name or [another name] to get results from another block"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn list-mode-btn" aria-label="List mode"><img src="/icons/list-mode.svg"></button>
                <div class="group-btn">
                <button class="tool-btn entry-btn" aria-label="Entry"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn" aria-label="Lock"><img src="/icons/lock.svg"></button>
                </div>
            </div>
            `,


    IMPORTED_IMAGE: `
            <div class="group-header">
                <small><img src="/icons/imported-image.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <div class="image-import-container">
                <div class="drop-zone">Drop image here<br/>or click to load</div>
            </div>
            <img class="result" alt="Imported image" style="display:none;">
            <div class="function-buttons-container" style="display:none;">
                <button class="tool-btn clear-btn" aria-label="Clear" ><img src="/icons/clear.svg"></button>
                </div>
            </div>
            `,


    TEXT: `
            <div class="group-header">
                <small><img src="/icons/text-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use: text, #name or [another name] to get results from another block"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to transform data into result"></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn list-mode-btn"><img alt="List mode" src="/icons/list-mode.svg"></button>
                <div class="group-btn">
                <button class="tool-btn entry-btn" aria-label="Entry"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn" aria-label="Lock"><img src="/icons/lock.svg"></button>
                </div>
                <button class="tool-btn refresh-btn" aria-label="Refresh"><img src="/icons/refresh.svg"></button>
            </div>
            `,

    IMAGE: `
            <div class="group-header">
                <small><img src="/icons/image-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this Block">
            <textarea class="data-text" placeholder="Data you want to use: visual keywords, #name or [another name] to get results from another block"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Visual keywords like 'oil painting', 'vector logo', etc. "></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn controlnet-btn" aria-label="Controlnet"><img src="/icons/controlnet.svg"></button>
                <div class="group-btn">
                <button class="tool-btn entry-btn" aria-label="Entry"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn" aria-label="Lock"><img src="/icons/lock.svg"></button>
                </div>
                <button class="tool-btn refresh-btn" aria-label="Refresh"><img src="/icons/refresh.svg"></button>
            </div>

            <img class="result"  alt="Imported image"  style="display:none;">
            <a class="tool-btn download-btn" aria-label="Download"><img src="/icons/download.svg"></a>
            `,

};

function createGroupInLocalDataStructures(groupType) {

    const groups = groupsMap.GROUPS;

    const id = generateUniqueGroupID(groups);

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

    console.log("[GROUP MANAGEMENT] New group in data:", group);

    groups.set(group.id, group);

    // we need this new isolated group in the graph
    // as the graph is used by the updateGroups function
    updateReferenceGraph(groups);

    return group;
}

function addGroupElement(groupType = GROUP_TYPE.TEXT, groupId) {

    const groups = groupsMap.GROUPS;

    const groupElement = document.createElement("div");

    groupElement.dataset.id = groupId;

    groupType = groups.get(groupId).type || GROUP_TYPE.TEXT;

    switch (groupType) {

        case GROUP_TYPE.BREAK:
            groupElement.className = "group break";
            groupElement.innerHTML = GROUP_HTML.BREAK;
            break;

        case GROUP_TYPE.STATIC:
            groupElement.className = "group static";
            groupElement.innerHTML = GROUP_HTML.STATIC;
            break;

        case GROUP_TYPE.IMPORTED_IMAGE:
            groupElement.className = "group imported-image";
            groupElement.innerHTML = GROUP_HTML.IMPORTED_IMAGE;
            break;

        case GROUP_TYPE.IMAGE:
            groupElement.className = "group image";
            groupElement.innerHTML = GROUP_HTML.IMAGE;
            break;

        default:
            groupElement.className = "group text";
            groupElement.innerHTML = GROUP_HTML.TEXT;
    }

    // Group element is populated, we can now set the elements

    const groupNameElement = groupElement.querySelector(".group-name");

    groupNameElement.value = groups.get(groupId).name;

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

    // Initially hide the download button
    const downloadButton = groupElement.querySelector(".download-btn");
    if (downloadButton) {
        downloadButton.style.display = 'none';
    }

    const container = document.querySelector(".container");
    container.appendChild(groupElement);

    addEventListenersToGroup(groupElement);

    groupElement.scrollIntoView(true, { behavior: "auto", block: "end" });

    const animationendHandler = () => {
        groupElement.classList.remove('new-group-appearing');
        groupElement.removeEventListener('animationend', animationendHandler);
    }

    groupElement.addEventListener(
        'animationend',
        animationendHandler
    );

    groupElement.classList.add('new-group-appearing');

    return groupElement;
}

// this function combine the creation of group as local data, persisted on the server, and as an HTML element 
function createGroupAndAddGroupElement(groupType = GROUP_TYPE.TEXT) {

    const groups = groupsMap.GROUPS;

    const group = createGroupInLocalDataStructures(groupType);

    persistGroups(groups);

    const groupElement = addGroupElement(groupType, group.id);

    return groupElement;
}

function addEventListenersToGroup(groupElement) {

    const groups = groupsMap.GROUPS;

    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const transformElement = groupElement.querySelector(".transform-text");

    const group =
        groups.get(
            getGroupIdFromElement(groupElement)
        );

    console.log("got group:", group)
    console.log("adding listener to group :", group.name)

    // Handle drag events to fix custom cursors with SortableJS 
    // https://github.com/SortableJS/Vue.Draggable/issues/815#issuecomment-1552904628
    // these drag events won't be fired on iOS, so we use them only for the cursor fix

    groupElement.addEventListener("dragstart", onDragStart);
    groupElement.addEventListener("dragend", onDragEnd);

    // Persist and handle change when a group's name, data or transform changes

    groupNameElement?.addEventListener("change", nameChangeHandler(group, groupNameElement, groups));

    dataElement?.addEventListener('change',
        () => {

            handleInputChange(groupElement, true, false, true, groups);

        });


    transformElement?.addEventListener("change", () => {
        handleInputChange(groupElement, true, false, true, groups);
    });


    dataElement?.addEventListener("blur", () => {
        if (group.availableReferencedResults && group.availableReferencedResults.length > 0) {
            displayCombinedReferencedResult(groupElement, group.combinedReferencedResults);
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

    // Event listeners for imported image 
    const dropZone = groupElement.querySelector(".drop-zone");

    dropZone?.addEventListener("dragover", event => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add("drop-zone-over");
    });

    dropZone?.addEventListener("dragleave", event => {
        event.preventDefault();
        event.stopPropagation()
        dropZone.classList.remove("drop-zone-over");
    });

    dropZone?.addEventListener(
        'click',
        (event) => { handleImportedImage(group, groupElement) }
    );

    dropZone?.addEventListener(
        'drop',
        (event) => {

            event.preventDefault();
            event.stopPropagation();

            event.currentTarget.classList.remove('drop-zone-over');

            const imageFile = event.dataTransfer.files[0];

            handleDroppedImage(imageFile, group, groupElement)
        }
    );


    /******** Tool buttons *************/
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement));

    groupElement.querySelector(".list-mode-btn")?.addEventListener("click", (event) => {

        group.resultDisplayFormat = (group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.LIST) ? RESULT_DISPLAY_FORMAT.TEXT : RESULT_DISPLAY_FORMAT.LIST;

        if (group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.LIST) { event.currentTarget.classList.add("selected"); }
        else { event.currentTarget.classList.remove("selected"); }

        setGroupResultDisplayFormat(groupElement, group.resultDisplayFormat);
        displayFormattedResults(groupElement);
        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".controlnet-btn")?.addEventListener("click", (event) => {
        group.controlnetEnabled = group.controlnetEnabled === true ? false : true;

        displayControlnetStatus(groupElement, group.controlnetEnabled)

        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".lock-btn")?.addEventListener("click", (event) => {
        group.interactionState = group.interactionState === INTERACTION_STATE.LOCKED ? INTERACTION_STATE.OPEN : INTERACTION_STATE.LOCKED;
        displayGroupInteractionState(groupElement, group.interactionState);
        persistGroups(groups);
    });

    groupElement.querySelector(".entry-btn")?.addEventListener("click", (event) => {
        group.interactionState = group.interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.OPEN : INTERACTION_STATE.ENTRY;
        displayGroupInteractionState(groupElement, group.interactionState);
        persistGroups(groups);
    });


    groupElement.querySelector(".refresh-btn")?.addEventListener("click", () => handleInputChange(groupElement, true, true, true, groups));

    groupElement.querySelector(".clear-btn")?.addEventListener("click", () => clearImportedImage(group, groupElement));

}

function deleteGroup(groupElement) {

    const groups = groupsMap.GROUPS;

    const id = getGroupIdFromElement(groupElement);

    groupElement.remove();

    groups.delete(id);

    // the actual group data is now gone, 
    // so references to the group will be treated as wrong

    updateGroupsReferencingIt(id);

    // as updateGroupsReferencingIt() uses the graph to find the groups to update
    // we can only call removeNode() on the graph once all groups have been alerted.

    updateReferenceGraph(groups);

    persistGroups(groups);
}

function setGroupResultDisplayFormat(groupElement, resultDisplayFormat) {
    const group = groupsMap.GROUPS.get(getGroupIdFromElement(groupElement));
    group.resultDisplayFormat = resultDisplayFormat;
}

function displayGroupInteractionState(groupElement, interactionState) {
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

    const lockButton = groupElement.querySelector(".lock-btn");

    if (lockButton && interactionState === INTERACTION_STATE.LOCKED) { lockButton.classList.add("selected"); }
    else if (lockButton) { lockButton.classList.remove("selected"); }

    const entryButton = groupElement.querySelector(".entry-btn");

    if (entryButton && interactionState === INTERACTION_STATE.ENTRY) { entryButton.classList.add("selected"); }
    else if (entryButton) { entryButton.classList.remove("selected"); }
}

function displayControlnetStatus(groupElement, controlnetEnabled) {

    const controlnetButton = groupElement.querySelector(".controlnet-btn")

    if (controlnetButton && controlnetEnabled) { controlnetButton.classList.add("selected"); }
    else if (controlnetButton) { controlnetButton.classList.remove("selected"); }

}

async function updateGroups(idsOfGroupsToUpdate, forceRefresh = false) {

    const groups = groupsMap.GROUPS;

    // We sort the groups to update them in topological order
    // to avoid re-updating a group that would depends on both this group and another updated group

    // if forceRefresh is true, we will update all groups in order.
    // it useful foe example on loading.

    // select the isolated nodes, to update them without blocking
    let independentUpdates = idsOfGroupsToUpdate.filter(id =>
        referencesGraph.IS_USED_BY_GRAPH.indegree(id) === 0
        && referencesGraph.IS_USED_BY_GRAPH.outdegree(id) === 0
    );

    for (const id of independentUpdates) {

        console.log("[UPDATE GROUPS] Independent group, updating without awaiting", id)

        handleInputChange(
            getGroupElementFromId(id),
            true,
            forceRefresh,
            false,
            groups
        );
    };

    // filter out the independent nodes from the dependent updates
    let dependentUpdates = idsOfGroupsToUpdate.filter(id => !independentUpdates.includes(id));

    console.log("[UPDATE GROUPS] Dependent updates filtered: ", dependentUpdates);

    console.log("[UPDATE GROUPS] Independent Updates", independentUpdates);

    // The sort raise a CycleError if a cycle is found 
    try {
        dependentUpdates = referencesGraph.IS_USED_BY_GRAPH.topologicalSort(dependentUpdates);
        console.log("[UPDATE GROUPS] Dependent updates Sorted: ", dependentUpdates);

    } catch (error) {

        const dependentGroupNames = dependentUpdates.map(
            groupid => groups.get(groupid).name
        );

        console.log("[UPDATE GROUPS] [CycleError] Circular dependency between these groups:", dependentGroupNames)
        displayAlert(
            {
                issue: `Circular dependency between these groups: ${dependentGroupNames.join(", ")}`,
                action: "Remove circular references",
                variant: "warning",
                icon: "arrow-repeat",
                duration: 3000
            }
        );

        return;
    }

    const parallelTasks = getParallelTasks(referencesGraph.IS_USED_BY_GRAPH, dependentUpdates);

    console.log("[UPDATE GROUPS] parallel tasks: ", parallelTasks)

    for (const parallelTasksBatch of parallelTasks) {

        console.log("[UPDATE GROUPS] Parallel Tasks Batch: ", parallelTasksBatch);

        // Create an array of promises for the current batch

        const batchPromises = parallelTasksBatch.map(async id => {
            const ongoingUpdate = ONGOING_UPDATES.get(id);
            if (ongoingUpdate) {
                console.log("[UPDATE GROUPS] Already updating, waiting for completion", id);
                return await ongoingUpdate;
            } else {
                console.log("[UPDATE GROUPS] Dependent group, awaiting update", id);
                const updatePromise = handleInputChange(
                    getGroupElementFromId(id),
                    true,
                    forceRefresh,
                    false,
                    groups
                );

                // Track the ongoing update
                ONGOING_UPDATES.set(id, updatePromise);

                // Await the update promise and remove it from ongoingUpdates
                const result = await updatePromise;
                ONGOING_UPDATES.delete(id);
                return result;
            }

        });


        // Wait for the entire batch to complete before looping to the next batch of updating tasks
        await Promise.all(batchPromises);

    }

}

function updateGroupsReferencingIt(id) {

    // get the list of groups that depends on the changed group in their dataText
    // precomputed in the reverse graph.

    const idsOfGroupsToUpdate = referencesGraph.IS_USED_BY_GRAPH.adjacent(id);

    updateGroups(idsOfGroupsToUpdate, false);

}

function getParallelTasks(graph, nodeList) {
    // Filter the nodes to include only those in the nodeList
    const filteredGraph = Graph();
    nodeList.forEach(node => {
        if (graph.nodes().includes(node)) {
            filteredGraph.addNode(node);
        }
    });

    // Add reversed edges to the filtered graph
    nodeList.forEach(node => {
        graph.adjacent(node).forEach(adjNode => {
            if (nodeList.includes(adjNode)) {
                // Reverse the edge direction
                filteredGraph.addEdge(adjNode, node);
            }
        });
    });

    const sortedNodes = filteredGraph.topologicalSort();
    const parallelTasks = [];
    const visited = new Set();

    // Helper function to check if all successors of a node are visited
    function areSuccessorsVisited(node) {
        return filteredGraph.adjacent(node).every(successor => visited.has(successor));
    }

    while (visited.size < sortedNodes.length) {
        let currentBatch = [];

        for (const node of sortedNodes) {
            if (!visited.has(node) && areSuccessorsVisited(node)) {
                currentBatch.push(node);
                visited.add(node);
            }
        }

        if (currentBatch.length > 0) {
            parallelTasks.push(currentBatch);
        }
    }

    return parallelTasks;
}


function displayCombinedReferencedResult(groupElement, combinedReferencedResults) {
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    console.log(`[DISPLAY] Displaying the group referenced result in refResultTextarea`);

    refResultTextarea.value = combinedReferencedResults ? combinedReferencedResults : "";
    refResultTextarea.style.display = "block";
    dataText.style.display = "none";

    return combinedReferencedResults;
}

function displayDataText(groupElement) {
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    console.log("[DISPLAY] Displaying the group data text, probably because no references exist or match");

    refResultTextarea.style.display = "none";
    dataText.style.display = "block";
}

function displayDataTextReferenceStatus({
    groupElement,
    hasReferences,
    invalidReferencedResults,
    notreadyReferencedResults,
    availableReferencedResults }) {

    const dataTextElement = groupElement.querySelector(".data-text");
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");

    dataTextElement.classList.remove('error', 'warning', 'valid');
    refResultTextarea.classList.remove('error', 'warning', 'valid');

    if (hasReferences) {
        if (
            invalidReferencedResults.length > 0
            && notreadyReferencedResults.length === 0
            && availableReferencedResults.length === 0
        ) {
            dataTextElement.classList.add('error');
            refResultTextarea.classList.add('error');
        }
        else if (
            invalidReferencedResults.length > 0
            && (notreadyReferencedResults.length > 0 || availableReferencedResults.length > 0)
        ) {
            dataTextElement.classList.add('warning');
            refResultTextarea.classList.add('warning');
        }
        else if (
            invalidReferencedResults.length === 0
            && (notreadyReferencedResults.length > 0 || availableReferencedResults.length > 0)
        ) {
            dataTextElement.classList.add('valid');
            refResultTextarea.classList.add('valid');
        }
    }
}


function parseResultsAsList(text) {
    // Define regular expressions for different list formats
    const listPatterns = {
        dashList: /^\s*-\s+(.+)/gm,             // - item
        asteriskList: /^\s*\*\s+(.+)/gm,        // * item
        numberedDotList: /^\s*\d+\.\s+(.+)/gm,  // 1. item
        numberedSlashList: /^\s*\d+\/\s+(.+)/gm,// 1/ item
        quotedList: /"([^"]+)"\s*(?:,\s*|\s+and\s+)?/g, // "item1", "item2", and "item3"
        commaSeparatedList: /(?:\b|^)\s*(?:and\s+)?([^,]+?)(?=\s*,|\s+and\s+|$)/g // item1, item2, item3
    };

    // Determine the most probable list format
    let format;
    if (listPatterns.dashList.test(text)) {
        format = 'dashList';
    } else if (listPatterns.asteriskList.test(text)) {
        format = 'asteriskList';
    } else if (listPatterns.numberedDotList.test(text)) {
        format = 'numberedDotList';
    } else if (listPatterns.numberedSlashList.test(text)) {
        format = 'numberedSlashList';
    } else if (listPatterns.quotedList.test(text)) {
        format = 'quotedList';
    } else if (listPatterns.commaSeparatedList.test(text)) {
        format = 'commaSeparatedList';
    }

    if (!format) {
        return [];
    }

    // Reset regex lastIndex to ensure starting from the beginning of the text
    listPatterns[format].lastIndex = 0;

    let items = [];
    let match;
    while ((match = listPatterns[format].exec(text)) !== null) {
        items.push(match[1].trim());
    }

    // Create a list only if there are at least two matching elements
    return items.length >= 2 ? items : [];
}

function displayFormattedResults(groupElement) {
    const resultElement = groupElement.querySelector(".result");

    const group = groupsMap.GROUPS.get(getGroupIdFromElement(groupElement));

    if (!group.result) { return; }

    if (group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.LIST) {

        const listItems = parseResultsAsList(group.result);

        console.log("[DISPLAYING FORMATTED RESULT] ", listItems)

        if (listItems.length === 0) {
            displayAlert(
                {
                    issue: `No list found in ${group.name}'s results`,
                    action: "Try to ask for a bulletpoint list",
                    variant: "warning",
                    icon: "list-ul",
                    duration: 3000
                }
            );
            return;
        }

        group.savedResult = group.result;
        group.listItems = listItems;

        resultElement.style.display = 'none';

        let existingSelectPosition;

        const existingSlSelect = groupElement.querySelector("sl-select");
        if (existingSlSelect) {
            existingSelectPosition = existingSlSelect.value;
            existingSlSelect.remove();
        }

        let selectElement = document.createElement('sl-select');
        selectElement.setAttribute('placeholder', 'Random choice');
        selectElement.setAttribute('clearable', '');
        selectElement.setAttribute('size', 'small');

        group.listItems.forEach((item, index) => {
            let optionElement = document.createElement('sl-option');
            optionElement.setAttribute('value', index);
            optionElement.textContent = item;
            selectElement.appendChild(optionElement);
        });

        // keeping the position in the list if possible. 
        // This is useful for users when using list format to split a list items through several blocks
        // Ex: list generated => reference the full list and pick item 1 in a static text block, item 2 into another, etc.
        if (existingSelectPosition && existingSelectPosition <= group.listItems.length - 1) {
            selectElement.value = existingSelectPosition;
        }

        handleListSelectionChange(selectElement, group, group.listItems);

        selectElement.addEventListener(
            "sl-change",
            (event) => {
                handleListSelectionChange(selectElement, group, group.listItems);
            });

        resultElement.after(selectElement);

    } else if (group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.TEXT || !group.resultDisplayFormat) {
        resultElement.style.display = 'block';

        const existingSlSelect = groupElement.querySelector("sl-select");

        if (existingSlSelect) {
            group.result = group.savedResult;
            group.listItems = [];
            existingSlSelect.remove();
        }

        updateGroupsReferencingIt(group.id)
    }
}

function rebuildGroupsInNewOrder() {
    // Intermediary Map to store the reordered groups

    const newGroups = new Map();

    const groupElements = document.querySelectorAll('.container .group');

    groupElements.forEach(element => {

        const id = element.getAttribute('data-id');

        // Retrieve the group object from groupsMap.GROUPS
        // to set it into the newGroups map
        newGroups.set(id, groupsMap.GROUPS.get(id));
    });

    console.log("[REORDERING GROUPS] Old group: ", groupsMap.GROUPS, " New groups ", newGroups);

    groupsMap.GROUPS = newGroups;

    console.log("[REORDERING GROUPS] reordered groups as: ", groupsMap.GROUPS);

    document.title = `${groupsMap.GROUPS.values().next().value.name} · Esquisse AI`;

    persistGroups(groupsMap.GROUPS);
}