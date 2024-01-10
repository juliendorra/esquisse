import { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, generateUniqueGroupID } from "./group-utils.js";
import { groupsMap, createGroupInLocalDataStructures, addGroupElement, displayGroupInteractionState, updateGroups, } from "./group-management.js"
import { updateReferenceGraph } from "./reference-graph.js";
import Validator from 'https://esm.run/jsonschema';
import { displayAlert } from "./ui-utils.js";

let ID = null;
let CREATOR = null;

const VERSION = "2023-11-05";
let APP_VERSION_TIMESTAMP;

const PACKAGED_GROUPS_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "version": {
            "type": "string",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" // pattern YYYY-MM-DD date
        },
        "groups": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string"
                    },
                    "data": {
                        "type": "string"
                    },
                    "transform": {
                        "type": "string"
                    },
                    "type": {
                        "type": "string",
                        "enum": Object.values(GROUP_TYPE)
                    },
                    "interactionState": {
                        "type": "string",
                        "enum": Object.values(INTERACTION_STATE)
                    },
                    "resultDisplayFormat": {
                        "type": "string",
                        "enum": Object.values(RESULT_DISPLAY_FORMAT)
                    }
                },
                "required": ["name", "data", "transform", "type", "interactionState"],
                "additionalProperties": false
            }
        }
    },
    "required": ["version", "groups"],
    "additionalProperties": false
}


export { persistGroups, loadGroups, downloadEsquisseJson, handleEsquisseJsonUpload };

async function persistGroups(groups) {

    const packagedGroups = packageGroups(groups);

    const previousId = ID;
    const previousCreator = CREATOR;

    await persistOnServer(packagedGroups, ID); // side-effect mutate ID and CREATOR

    const isFreshApp = previousId === null;
    const isNewByDifferentUser = previousId !== ID && previousCreator !== CREATOR;

    if (!isFreshApp && isNewByDifferentUser) {
        displayAlert(
            {
                issue: `Remix of ${previousCreator}'s app saved to your apps`,
                action: `You can modify it and come back to it anytime using this page url. ${previousCreator}'s app won't be modified`,
                variant: "success",
                icon: "copy",
                duration: 5000
            }
        );
    }

    console.log("[PERSIST] Rewriting URL with ID")

    const url = "/app/" + ID;

    history.pushState(groups, "", url);

}

function packageGroups(groups) {
    let packagedGroups = {};

    packagedGroups.version = VERSION;

    // we store the groups array in the groups property
    packagedGroups.groups = Array.from(groups.values()).map(({ name, data, transform, type, interactionState, resultDisplayFormat }) => ({
        name,
        data,
        transform,
        type,
        interactionState,
        resultDisplayFormat,
    }));
    return packagedGroups;
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

        ({ id: ID, username: CREATOR } = await response.json());

        console.log("[PERSIST] Id sent by server", ID);
        console.log("[PERSIST] Username sent back by server", CREATOR);

        return { ID, CREATOR };

    } catch (error) {
        console.error("Error in persisting groups", error);
    }
}

async function loadGroups(importedGroups) {

    const urlPath = window.location.pathname;

    let decodedGroups = [];

    groupsMap.GROUPS = new Map();
    const groups = groupsMap.GROUPS;

    const nanoidRegex = /^\/app\/[123456789bcdfghjkmnpqrstvwxyz]{14}$/;

    if (importedGroups) {
        decodedGroups = importedGroups;
        ID = null;
    }
    // Check if the URL path is of the form /app/[NANOID]
    else if (urlPath.startsWith('/app/') && nanoidRegex.test(urlPath)) {

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

            const appVersion = json;

            // appVersion: {
            //   type,
            //   timestamp,
            //   value:{versiongroups,appid,timestamp,username}
            //  }

            APP_VERSION_TIMESTAMP = appVersion.timestamp;

            decodedGroups = appVersion.value;
            CREATOR = decodedGroups.username;

        } catch (error) {
            console.error("[LOADING] Error loading groups from server", error);

            return createBlankApp();
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

        return createBlankApp();
    }

    // using the decoded group data to create each group

    try {
        console.log("[LOADING] loading groups", decodedGroups);

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        decodedGroups.groups.forEach(({ name, data, transform, type, interactionState, resultDisplayFormat }) => {
            const group = {
                id: generateUniqueGroupID(groups),
                name,
                data,
                transform,
                type: type || GROUP_TYPE.TEXT,
                result: null,
                lastRequestTime: 0,
                interactionState: interactionState || INTERACTION_STATE.OPEN,
                resultDisplayFormat: resultDisplayFormat || undefined,
            };

            groups.set(group.id, group);

            const groupElement = addGroupElement(group.type, group.id);

            const groupNameElement = groupElement.querySelector(".group-name");
            const dataElement = groupElement.querySelector(".data-text");
            const transformElement = groupElement.querySelector(".transform-text");

            // Break groups elements don't have data and transform elements
            if (groupNameElement) groupNameElement.value = group.name;
            if (dataElement) dataElement.value = group.data;
            if (transformElement) transformElement.value = transform;

            // displayGroupInteractionState display the right UI state based on the set group.interactionState
            displayGroupInteractionState(groupElement, group.interactionState);

        });
    } catch (error) {

        ID = null;

        console.error("[LOADING] Error loading groups", error);
    }

    if (!ID) { persistGroups(groups); }

    console.log("[LOADING] groups loaded: ", groups);

    document.title = groups.values().next().value?.name ? `${groups?.values().next().value.name} · Esquisse AI` : "Esquisse AI. Quick AI Workflow Prototyping"

    const isUsedByGraph = updateReferenceGraph(groups);

    // update all nodes, in topological order
    // this will fail if a cycle is detected
    updateGroups(isUsedByGraph.nodes(), true);

    return { groups, isUsedByGraph };

    function createBlankApp() {
        console.log("[LOADING] new Esquisse, creating a group");

        const group = createGroupInLocalDataStructures(GROUP_TYPE.TEXT);

        const groupElement = addGroupElement(GROUP_TYPE.TEXT, group.id);

        ID = null;

        history.pushState(groups, "", "/app");

        // we are interested in having even this first isolated node in the graph
        // as we will use it in the updateGroups function
        const isUsedByGraph = updateReferenceGraph(groups);

        return { groups, isUsedByGraph };
    }
}

function downloadEsquisseJson(groups) {

    const packagedGroups = packageGroups(groups);

    const jsonData = JSON.stringify(packagedGroups);

    const blob = new Blob([jsonData], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    a.download = `${groups.values().next().value.name}.esquisse.json`;
    a.click();

    URL.revokeObjectURL(url);
}

async function handleEsquisseJsonUpload(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        try {
            const jsonData = JSON.parse(text);

            const validator = new Validator.Validator();
            const validationResult = validator.validate(jsonData, PACKAGED_GROUPS_SCHEMA);
            if (!validationResult.valid) {

                displayAlert(
                    {
                        issue: "Files is not a valid .esquisse.json",
                        action: "Use a file downloaded from an app",
                        variant: "warning"
                    }
                );

                return;
            }

            loadGroups(jsonData);

        } catch (error) {
            console.error("Error parsing JSON file", error);
        }
    };
    reader.readAsText(file);
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



