import { GROUP_TYPE, INTERACTION_STATE, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateUniqueGroupID } from "./group-utils.js";

import { displayAlert } from "./ui-utils.js";

import { handleInputChange, nameChangeHandler, handleImportedImage, handleDroppedImage } from "./input-change.js";
import { onDragStart, onDragEnd } from "./reordering.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";

import { persistGroups } from "./persistence.js";

let PRIVATE_GROUPS = new Map();

const groupsMap = {
    get GROUPS() {
        return PRIVATE_GROUPS;
    },
    set GROUPS(map) {
        PRIVATE_GROUPS = map;
    }
};

export {
    groupsMap, createGroupInLocalDataStructures,
    addGroupElement, createGroupAndAddGroupElement, addEventListenersToGroup, deleteGroup, setGroupInteractionState, updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, rebuildGroupsInNewOrder
};

const GROUP_HTML = {

    BREAK: `
            <div class="group-header">
                <small><img src="/icons/break.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            `,

    STATIC: `
            <div class="group-header">
                <small><img src="/icons/text-static.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn entry-btn"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn"><img src="/icons/lock.svg"></button>
            </div>
            `,


    IMPORTED_IMAGE: `
            <div class="group-header">
                <small><img src="/icons/imported-image.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn"><img src="/icons/delete.svg"></button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <div class="image-import-container">
                <div class="drop-zone">Drop image here<br/>or click to load</div>
            </div>
            <img class="result" style="display:none;">
            `,


    TEXT: `
            <div class="group-header">
                <small><img src="/icons/text-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn entry-btn"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn"><img src="/icons/lock.svg"></button>
                <button class="tool-btn refresh-btn"><img src="/icons/refresh.svg"></button>
            </div>
            `,

    IMAGE: `
            <div class="group-header">
                <small><img src="/icons/image-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this Block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>

            <div class="function-buttons-container">
                <button class="tool-btn entry-btn"><img src="/icons/entry.svg"></button>
                <button class="tool-btn lock-btn"><img src="/icons/lock.svg"></button>
                <button class="tool-btn refresh-btn"><img src="/icons/refresh.svg"></button>
            </div>

            <img class="result">
            <a class="tool-btn download-btn"><img src="/icons/download.svg"></a>
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
    const resultImage = groupElement.querySelector(".result");

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
        (event) => { handleImportedImage(event, resultImage, group, groups) }
    );

    dropZone?.addEventListener(
        'drop',
        (event) => {

            event.preventDefault();
            event.stopPropagation();

            event.currentTarget.classList.remove('drop-zone-over');

            const imageFile = event.dataTransfer.files[0];

            handleDroppedImage(imageFile, groupElement, groups)

        }
    );


    /******** Tool buttons *************/
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement));


    groupElement.querySelector(".lock-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.LOCKED ? INTERACTION_STATE.OPEN : INTERACTION_STATE.LOCKED;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups(groups);
    });

    groupElement.querySelector(".entry-btn")?.addEventListener("click", () => {
        group.interactionState = group.interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.OPEN : INTERACTION_STATE.ENTRY;
        setGroupInteractionState(groupElement, group.interactionState);
        persistGroups(groups);
    });


    groupElement.querySelector(".refresh-btn")?.addEventListener("click", () => handleInputChange(groupElement, true, true, true, groups));


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

    for (const id of dependentUpdates) {

        console.log("[UPDATE GROUPS] Dependent group, awaiting update", id)

        // if we don't await, a further group might launch a request when it actually depends on the previous group results
        // we stop being fully reactive and fully async here
        // and await between each steps
        // we should probably use the graph more to async everything that can

        await handleInputChange(
            getGroupElementFromId(id),
            true,
            forceRefresh,
            false,
            groups
        );
    };
}

function updateGroupsReferencingIt(id) {

    // get the list of groups that depends on the changed group in their dataText
    // precomputed in the reverse graph.

    const idsOfGroupsToUpdate = referencesGraph.IS_USED_BY_GRAPH.adjacent(id);

    updateGroups(idsOfGroupsToUpdate, false);

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