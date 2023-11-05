import { GROUP_TYPE, generateUniqueGroupID } from "./group-utils.js";
import { addGroupElement, createGroupAndAddGroupElement, setGroupInteractionState, updateGroups } from "./group-management.js"
import { buildReverseReferenceGraph } from "./reference-graph.js";
import { handleInputChange } from "./input-change.js";

let PRIVATE_HAS_HASH_CHANGED_PROGRAMMATICALLY = false;

const VERSION = "2023-11-05";

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

    let strippedGroups = {};

    strippedGroups.version = VERSION;

    // we store the groups array is in the groups property

    strippedGroups.groups = Array.from(groups.values()).map(({ name, data, transform, type, interactionState }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
    }));

    console.log("Persisting in URL", strippedGroups);

    try {
        const base64Groups = base64UnicodeEncode(strippedGroups);
        console.log("btoa groups", base64Groups);

        urlOrigin.HAS_HASH_CHANGED_PROGRAMMATICALLY = true;
        window.location.hash = base64Groups;
    } catch (error) {
        console.error("Base64 encoding failed, impossible to persist in URL", error);
    }
}

function loadGroups() {
    const base64EncodedGroups = window.location.hash.slice(1);

    let groups = new Map();

    if (!base64EncodedGroups) {
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT, groups);

        // we are interested in having even this first isolated node in the graph
        // as we will use it in the updateGroups function

        const isUsedByGraph = buildReverseReferenceGraph(groups);

        return { groups, isUsedByGraph };
    }

    let decodedGroups;

    try {
        // try to decode with the old, ASCII-only method
        try {
            decodedGroups = JSON.parse(atob(base64EncodedGroups));
        } catch (e) {
            // If there's an error, try decode UTF-8 characters
            decodedGroups = JSON.parse(base64UnicodeDecode(base64EncodedGroups));
        }

        // If the version field is present, re-decode using proper utf8 handling
        if (decodedGroups && decodedGroups.version) {
            // the newest format is an object and not just a raw array. The groups array is in the groups property
            decodedGroups = JSON.parse(base64UnicodeDecode(base64EncodedGroups)).groups;
        }

    } catch (error) {
        console.error("Base64 decoding failed", error);
    }

    try {

        console.log("loading groups from hash", decodedGroups);

        groups.clear();

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        decodedGroups.forEach(({ name, data, transform, type, interactionState }) => {
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

// Utils

// Function to encode a string as base64 while handling Unicode characters
function base64UnicodeEncode(obj) {
    const stringifyied = JSON.stringify(obj);
    const utf8Encoder = new TextEncoder();
    const byteArray = utf8Encoder.encode(stringifyied);

    // Convert the Uint8Array to a binary string (each byte as a char code)
    const base64ReadyString = Array.from(byteArray)
        .map(byte => String.fromCharCode(byte))
        .join('');

    return btoa(base64ReadyString);
}



// Function to decode a base64 string back while handling Unicode characters
function base64UnicodeDecode(base64String) {
    const binaryString = atob(base64String);
    const charCodeArray = binaryString.split('').map(character => character.charCodeAt(0));
    const utf8Decoder = new TextDecoder();
    return utf8Decoder.decode(new Uint8Array(charCodeArray));
}



