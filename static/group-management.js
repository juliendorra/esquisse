import { GROUP_TYPE, INTERACTION_STATE, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateUniqueGroupID } from "./group-utils.js";

import { getReferencedResultsAndCombinedDataWithResults } from "./reference-matching.js";
import { handleInputChange, nameChangeHandler } from "./input-change.js";
import { onDragStart, onDragEnd } from "./reordering.js";
import { referencesGraph } from "./reference-graph.js";

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

export { groupsMap, addGroupElement, createGroupAndAddGroupElement, addEventListenersToGroup, deleteGroup, setGroupInteractionState, updateGroups, updateGroupsReferencingIt, displayCombinedReferencedResult, displayDataText, rebuildGroupsInNewOrder };

function addGroupElement(groupType = GROUP_TYPE.TEXT, groupId, groups) {
    const groupElement = document.createElement("div");

    groupElement.dataset.id = groupId;

    switch (groupType) {

        case GROUP_TYPE.BREAK:
            groupElement.className = "group break";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small><img src="./icons/break.svg"></small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn"><img src="./icons/delete.svg"></button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
            `;
            break;

        case GROUP_TYPE.STATIC:
            groupElement.className = "group static";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small><img src="./icons/text-static.svg"></small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn"><img src="./icons/delete.svg"></button>
                </div>
                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>

                <div class="function-buttons-container">
                    <button class="tool-btn entry-btn"><img src="./icons/entry.svg"></button>
                    <button class="tool-btn lock-btn"><img src="./icons/lock.svg"></button>
                </div>
            `;
            break;

        case GROUP_TYPE.IMAGE:
            groupElement.className = "group image";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small><img src="./icons/image-gen.svg"></small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn"><img src="./icons/delete.svg"></button>
                </div>

                <input type="text" class="group-name" placeholder="Name of this Block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>

                <div class="function-buttons-container">
                    <button class="tool-btn entry-btn"><img src="./icons/entry.svg"></button>
                    <button class="tool-btn lock-btn"><img src="./icons/lock.svg"></button>
                    <button class="tool-btn refresh-btn"><img src="./icons/refresh.svg"></button>
                </div>

                <img class="result">
                <a class="tool-btn download-btn"><img src="./icons/download.svg"></a>
            `;
            break;

        default:
            groupElement.className = "group text";
            groupElement.innerHTML = `
                <div class="group-header">
                    <small><img src="./icons/text-gen.svg"></small>
                    <div class="drag-handle">···</div>
                    <button class="tool-btn delete-btn"><img src="./icons/delete.svg"></button>
                </div>

                <input type="text" class="group-name" placeholder="Name of this block">
                <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
                <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
                <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>

                <div class="function-buttons-container">
                    <button class="tool-btn entry-btn"><img src="./icons/entry.svg"></button>
                    <button class="tool-btn lock-btn"><img src="./icons/lock.svg"></button>
                    <button class="tool-btn refresh-btn"><img src="./icons/refresh.svg"></button>
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

    addEventListenersToGroup(groupElement, groups);

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

function createGroupAndAddGroupElement(groupType = GROUP_TYPE.TEXT, groups) {

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

    console.log("New group:", group)

    groups.set(group.id, group);

    // we are interested in having even the isolated groups in the graph
    // as we will use them in the updateGroups function
    // except for the break groups
    if (!GROUP_TYPE.BREAK) referencesGraph.IS_USED_BY_GRAPH.addNode(group.id);

    persistGroups(groups);

    const groupElement = addGroupElement(groupType, group.id, groups);

    const groupNameElement = groupElement.querySelector(".group-name");

    groupNameElement.value = group.name;

    return groupElement;
}

function addEventListenersToGroup(groupElement, groups) {
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
        const { availableReferencedResults, combinedReferencedResults } = getReferencedResultsAndCombinedDataWithResults(dataElement.value, group.name, groups);
        if (availableReferencedResults.length > 0) {
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
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement, groups));


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


function deleteGroup(groupElement, groups) {
    const id = getGroupIdFromElement(groupElement);

    groupElement.remove();

    groups.delete(id);

    // the actual group data is now gone, 
    // so references to the group will be treated as wrong

    updateGroupsReferencingIt(id, groups);

    // as updateGroupsReferencingIt() uses the graph to find the groups to update
    // we can only call removeNode() on the graph once all groups have been alerted.

    referencesGraph.IS_USED_BY_GRAPH.removeNode(id)

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

async function updateGroups(idsOfGroupsToUpdate, groups, forceRefresh = false) {

    // We sort the groups to update them in topological order
    // to avoid re-updating a group that would depends on both this group and another updated group

    // if forceRefresh is true, we will update all groups in order.
    // it useful foe example on loading.

    // select the isolated nodes, to update them without blocking
    let independentUpdates = idsOfGroupsToUpdate.filter(id =>
        referencesGraph.IS_USED_BY_GRAPH.indegree(id) === 0
        && referencesGraph.IS_USED_BY_GRAPH.outdegree(id) === 0
    );

    // filter out the independent nodes from the dependent updates
    let dependentUpdates = idsOfGroupsToUpdate.filter(id => !independentUpdates.includes(id));

    console.log("[UpdateGroups] Dependent updates Sorted: ", dependentUpdates);

    console.log("[UpdateGroups] Independent Updates", independentUpdates);

    // The sort raise a CycleError if a cycle is found 
    try {
        dependentUpdates = referencesGraph.IS_USED_BY_GRAPH.topologicalSort(idsOfGroupsToUpdate)

    } catch (error) {
        console.log("[CycleError] Circular dependency between these groups:", idsOfGroupsToUpdate)
        return;
    }

    for (const id of independentUpdates) {

        console.log("Independent group, updating without awaiting", id)

        handleInputChange(
            getGroupElementFromId(id),
            true,
            forceRefresh,
            false,
            groups
        );
    };

    for (const id of dependentUpdates) {

        console.log("Dependent group, awaiting update", id)

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

function updateGroupsReferencingIt(id, groups) {

    // get the list of groups that depends on the changed group in their dataText
    // precomputed in the reverse graph.

    const idsOfGroupsToUpdate = referencesGraph.IS_USED_BY_GRAPH.adjacent(id);

    updateGroups(idsOfGroupsToUpdate, groups, false);

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

    groupsMap.GROUPS = newGroups;

    document.title = `${groupsMap.GROUPS.values().next().value.name} · Esquisse AI`;

    persistGroups(groupsMap.GROUPS);
}