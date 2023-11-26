import { GROUP_TYPE, generateUniqueGroupID } from "./group-utils.js";
import { addGroupElement, createGroupAndAddGroupElement, setGroupInteractionState, updateGroups } from "./group-management.js"
import { buildReverseReferenceGraph } from "./reference-graph.js";
import { handleInputChange } from "./input-change.js";

let ID = null;

const VERSION = "2023-11-05";

export { persistGroups, loadGroups };

async function persistGroups(groups) {

    let packagedGroups = {};

    packagedGroups.version = VERSION;

    // we store the groups array in the groups property

    packagedGroups.groups = Array.from(groups.values()).map(({ name, data, transform, type, interactionState }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
    }));

    await persistOnServer(packagedGroups, ID);

    console.log("[PERSIST] Rewriting URL with ID")

    const url = "/app/" + ID;

    history.pushState(groups, "", url);

}

function persistInHash(packagedGroups) {

    console.log("[PERSIST] Persisting in URL", packagedGroups);

    try {
        const base64Groups = base64UnicodeEncode(packagedGroups);
        console.log("[PERSIST] btoa groups", base64Groups);

        window.location.hash = base64Groups;
    } catch (error) {
        console.error("[PERSIST] Base64 encoding failed, impossible to persist in URL", error);
    }
}

async function persistOnServer(packagedGroups, existingId = null) {

    console.log("[PERSIST] Persisting on server", packagedGroups);

    try {
        const response = await fetch('/persist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ groups: packagedGroups, id: existingId }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        ({ id: ID } = await response.json());

        console.log("[PERSIST] Id sent by server", ID)

    } catch (error) {
        console.error("Error in persisting groups", error);
    }
}

async function loadGroups() {

    const urlPath = window.location.pathname;

    let decodedGroups = [];
    let groups = new Map();

    // Check if the URL path is of the form /app/[NANOID]
    if (urlPath.startsWith('/app/')) {

        ID = urlPath.split('/')[2];

        try {
            const response = await fetch('/load', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: ID }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const json = await response.json();

            console.log(json)

            decodedGroups = json;

        } catch (error) {
            console.error("[LOADING] Error loading groups from server", error);
        }
    }
    else if (window.location.hash) {

        const base64EncodedGroups = window.location.hash.slice(1);

        console.log("[LOADING] hash based loading");

        ID = null;

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
                decodedGroups = JSON.parse(base64UnicodeDecode(base64EncodedGroups));
            }

        } catch (error) {
            console.error("[LOADING] Base64 decoding failed", error);
        }
    }
    else {

        console.log("[LOADING] new Esquisse, creating a group");

        createGroupAndAddGroupElement(GROUP_TYPE.TEXT, groups);

        // we are interested in having even this first isolated node in the graph
        // as we will use it in the updateGroups function

        const isUsedByGraph = buildReverseReferenceGraph(groups);

        ID = null;

        return { groups, isUsedByGraph };
    }

    // using the decoded group data to create each group

    try {
        console.log("[LOADING] loading groups", decodedGroups);

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        decodedGroups.groups.forEach(({ name, data, transform, type, interactionState }) => {
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
            if (transformElement) transformElement.value = transform;

            // setGroupInteractionState set the right UI state, 
            setGroupInteractionState(groupElement, group.interactionState);

        });
    } catch (error) {

        ID = null;

        console.error("[LOADING] Error loading groups", error);
    }

    if (!ID) { persistGroups(groups); }

    console.log("[LOADING] groups loaded: ", groups);

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



