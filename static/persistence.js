import { GROUP_TYPE, generateUniqueGroupID } from "./grouputils.js";
import { addGroupElement, createGroupAndAddGroupElement, setGroupInteractionState, updateGroups } from "./groupmanagement.js"
import { buildReverseReferenceGraph } from "./referencegraphmanagement.js";
import { handleInputChange } from "./inputchangehandler.js";

let PRIVATE_HAS_HASH_CHANGED_PROGRAMMATICALLY = false;

const urlOrigin = {
    get HAS_HASH_CHANGED_PROGRAMMATICALLY() {
        return PRIVATE_HAS_HASH_CHANGED_PROGRAMMATICALLY;
    },
    set HAS_HASH_CHANGED_PROGRAMMATICALLY(value) {
        PRIVATE_HAS_HASH_CHANGED_PROGRAMMATICALLY = value;
    }
}

export { urlOrigin, persistGroups, loadGroups };

function persistGroups(groups) {

    const strippedGroups = Array.from(groups.values()).map(({ name, data, transform, type, interactionState }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
    }));

    console.log("Persisting in URL", strippedGroups);
    console.log("stringifyied groups", JSON.stringify(strippedGroups));
    console.log("btoa groups", btoa(JSON.stringify(strippedGroups)));

    try {
        const base64Groups = btoa(JSON.stringify(strippedGroups));
        urlOrigin.HAS_HASH_CHANGED_PROGRAMMATICALLY = true;
        window.location.hash = base64Groups;
    } catch (error) {
        console.log("Base64 failed, impossible to persist in URL", error)
        return;
    }
}

function loadGroups() {
    const base64Groups = window.location.hash.slice(1);

    let groups = new Map();

    if (!base64Groups) {
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT, groups);

        // we are interested in having even this first isolated node in the graph
        // as we will use it in the updateGroups function

        const isUsedByGraph = buildReverseReferenceGraph(groups);

        return { groups, isUsedByGraph };
    }

    try {
        const strippedGroups = JSON.parse(atob(base64Groups));

        console.log("loading groups from hash", strippedGroups);

        groups.clear();

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        strippedGroups.forEach(({ name, data, transform, type, interactionState }) => {
            const group = {
                id: generateUniqueGroupID(groups),
                name,
                data,
                transform,
                type: type || GROUP_TYPE.TEXT,
                result: null,
                lastRequestTime: 0,
                interactionState: interactionState || INTERACTION_STATE.OPEN,
            };

            groups.set(group.id, group);

            const groupElement = addGroupElement(group.type, group.id, groups);

            const groupNameElement = groupElement.querySelector(".group-name");
            const dataElement = groupElement.querySelector(".data-text");
            const transformElement = groupElement.querySelector(".transform-text");

            // Break groups elements don't have name and data elements
            if (groupNameElement) groupNameElement.value = group.name;
            if (dataElement) dataElement.value = group.data;

            if (type === GROUP_TYPE.STATIC) {
                // If data is present, call handleInput to combine data and references into a referenceable result
                if (dataElement.value) {
                    handleInputChange(groupElement, true, false, true, groups);
                }
            }

            if (group.type === GROUP_TYPE.TEXT || group.type === GROUP_TYPE.IMAGE) {

                transformElement.value = transform;

                // If data is present and transform value is present, call handleInput to try to send an immediate API request
                if (dataElement.value && transformElement.value) {
                    handleInputChange(groupElement, true, false, true, groups);
                }
            }

            // setGroupInteractionState set the right UI state, 
            // using optional chaining to ignore absent inputs
            setGroupInteractionState(groupElement, group.interactionState);

        });
    } catch (error) {
        console.error("Error loading groups", error);
    }

    console.log("groups loaded: ", groups);

    document.title = `${groups.values().next().value.name} · Esquisse AI`

    const isUsedByGraph = buildReverseReferenceGraph(groups);

    // update all nodes, in topological order
    // this will fail if a cycle is detected
    updateGroups(isUsedByGraph.nodes(), groups, true);

    return { groups, isUsedByGraph };
}
