import { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, generateGroupUUID, generateUniqueGroupName } from "./group-utils.js";
import { groupsMap, createGroupInLocalDataStructures, addGroupElement, displayAllGroupsInteractionState, displayGroupInteractionState, displayControlnetStatus, displayTextGroupDisplayFormatButtons, updateGroups, } from "./group-management.js"
import { updateReferenceGraph } from "./reference-graph.js";
import Validator from 'https://esm.run/jsonschema';
import { displayAlert, removeGlobalWaitingIndicator, createZoomedImage, showAddBlocksButtons, hideAddBlocksButtons } from "./ui-utils.js";
import { captureThumbnail } from "./screen-capture.js"
import { fetchWithCheck } from "./network.js";

let ID = null;
let CREATOR = null;
let USERNAME = null;

const VERSION = "2024-07-17";
let APP_VERSION_TIMESTAMP;

let PENDING_CHANGES = 0;

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
                    "id": {
                        "type": "string"
                    },
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
                    "controlnetEnabled": {
                        "type": "boolean",
                    },
                    "resultDisplayFormat": {
                        "type": "string",
                        "enum": Object.values(RESULT_DISPLAY_FORMAT)
                    },
                    "hashImportedImage": {
                        "type": "string"
                    },
                },
                "required": ["name", "data", "transform", "type", "interactionState"],
                "additionalProperties": false
            }
        }
    },
    "required": ["version", "groups"],
    "additionalProperties": false
}

export { getAppMetaData, persistGroups, beaconGroups, persistGroupsOnHide, persistImage, loadGroups, shareResult, downloadEsquisseJson, handleEsquisseJsonUpload };

function getAppMetaData() {
    return { ID, CREATOR, USERNAME, APP_VERSION_TIMESTAMP, PENDING_CHANGES }
}

const persistGroups = throttle(persistGroupsUnthrottled, 30000, 10, setPendingChanges)

function persistGroupsOnHide(groups) {
    if (document.visibilityState == 'hidden' && PENDING_CHANGES > 0) {
        persistGroupsUnthrottled(groupsMap.GROUPS);
        setPendingChanges(0);
    }
}

function beaconGroups(groups) {

    if (PENDING_CHANGES > 0) {
        const packagedGroups = packageGroups(groups);

        navigator.sendBeacon('/persist', JSON.stringify({ groups: packagedGroups, id: ID }));
    }
}

function setPendingChanges(value) {
    PENDING_CHANGES = value;
    console.log("Pending changes:", PENDING_CHANGES)
}


async function persistGroupsUnthrottled(groups) {

    const packagedGroups = packageGroups(groups);

    if (!arePackagedGroupsValid()) {
        displayAlert(
            {
                issue: "Failed to prepare your app for saving",
                action: "Copy the most important elements manually and refresh the page",
                variant: "warning"
            }
        );
        console.log("[IMPORTING APP] Invalid json: ", validationResult)
        return;
    }

    const previousId = ID;
    const previousCreator = CREATOR;

    await persistOnServer(packagedGroups, ID); // side-effect mutate ID and CREATOR

    const isFreshApp = previousId === null;
    const isNewByDifferentUser = previousId !== ID && previousCreator !== CREATOR;

    if (!isFreshApp && isNewByDifferentUser) {
        displayAlert(
            {
                issue: `Clone of ${previousCreator}'s app saved to your apps`,
                action: `You can modify it and come back to it anytime using this page url. ${previousCreator}'s app won't be modified`,
                variant: "success",
                icon: "copy",
                duration: 5000
            }
        );

        displayAllGroupsInteractionState();
        showAddBlocksButtons();
    }

    console.log("[PERSIST] Rewriting URL with ID")

    const url = "/app/" + ID;

    history.pushState(groups, "", url);

}

function packageGroups(groups, { packageIds = true } = { packageIds: true }) {
    let packagedGroups = {};

    packagedGroups.version = VERSION;

    // Convert the Map's values to an array and sort them based on their index property
    let sortedGroups = Array.from(groups.values()).sort((a, b) => a.index - b.index);

    // Now, map the sorted groups to the desired structure
    packagedGroups.groups = sortedGroups.map((group) => ({
        id: packageIds ? group.id : "",
        name: group.name,
        // We don't package the data text if the block is set to Entry (i.e., as a temporary input)
        data: group.interactionState === INTERACTION_STATE.ENTRY ? "" : group.data,
        transform: "",
        type: group.type,
        interactionState: group.interactionState,
        controlnetEnabled: group.controlnetEnabled,
        resultDisplayFormat: group.resultDisplayFormat,
        // We don't package the hashImportedImage value if the block is set to Entry (i.e., as a temporary input)
        hashImportedImage: group.interactionState === INTERACTION_STATE.ENTRY ? "" : group.hashImportedImage,
    }));

    return packagedGroups;
}

async function persistOnServer(packagedGroups, existingId = null) {

    console.log("[PERSIST] Persisting on server", packagedGroups);

    try {
        const response = await fetchWithCheck('/persist', {
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

async function persistImage(imageBlob) {

    if (!imageBlob || imageBlob.type !== "image/jpeg") {
        return;
    }

    const imageB64 = await fileToBase64(imageBlob)

    console.log("[PERSIST] Persist image on server");

    try {
        const response = await fetchWithCheck('/persist-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                {
                    image: imageB64,
                }
            ),
        });

        if (!response.ok) {
            throw new Error(response);
        }

        const { imageHash } = await response.json();

        console.log("[PERSIST] image hash sent by server", imageHash);

        return imageHash;

    } catch (error) {
        console.error("Error in persisting image", error.body);
        displayAlert(
            {
                issue: "Imported image not saved",
                action: "You can still use the app!",
                variant: "warning"
            }
        );
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
        ID = "";
    }
    // Check if the URL path is of the form /app/[NANOID]
    else if (urlPath.startsWith('/app/') && nanoidRegex.test(urlPath)) {

        ID = urlPath.split('/')[2];

        try {
            const response = await fetchWithCheck('/load', {
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

            decodedGroups = appVersion.value || [];
            CREATOR = decodedGroups.username || "";
            USERNAME = response.headers.get("x-username") || "";

        } catch (error) {
            console.error("[LOADING] Error loading groups from server", error);

            return createBlankApp();
        }
    }
    else {
        showAddBlocksButtons();
        return createBlankApp();
    }

    const userIsAppAuthor = importedGroups || CREATOR === USERNAME;

    console.log("Is the current user the author of the app? ", userIsAppAuthor)

    if (userIsAppAuthor) { showAddBlocksButtons(); }
    else { hideAddBlocksButtons(); };

    // using the decoded group data to create each group

    try {
        console.log("[LOADING] loading groups", decodedGroups);

        const groupsContainer = document.querySelector(".container");
        groupsContainer.innerHTML = "";

        await Promise.all(
            decodedGroups.groups.map(
                async (
                    { id, name, data, transform, type, interactionState, controlnetEnabled, resultDisplayFormat, hashImportedImage },
                    index) => {

                    // for retro compatibilty with previous apps, load any transform text into data
                    let compatibleData = "";
                    if (data) {
                        if (transform) {
                            compatibleData = data + "\n\n" + transform;
                        } else {
                            compatibleData = data;
                        }
                    }

                    let compatibleInteractionState = interactionState;

                    // Older apps might have text generation groups state set to entry, which is now reserved to Static and Imported image groups
                    if ((type === GROUP_TYPE.TEXT || type === GROUP_TYPE.IMAGE) && interactionState === INTERACTION_STATE.ENTRY) {
                        compatibleInteractionState = INTERACTION_STATE.OPEN;
                    }
                    // Older apps might have an interaction state set to locked, which is now only a temp state when using another's app
                    if (interactionState === INTERACTION_STATE.LOCKED) {
                        compatibleInteractionState = INTERACTION_STATE.OPEN;
                    }

                    const group = {
                        id: id || generateGroupUUID(),
                        index: index,
                        name: name || generateUniqueGroupName(type, groups),
                        data: compatibleData,
                        transform: "",
                        type: type || GROUP_TYPE.TEXT,
                        result: "",
                        interactionState: compatibleInteractionState,
                        controlnetEnabled: controlnetEnabled || undefined,
                        resultDisplayFormat: resultDisplayFormat
                            || (type === GROUP_TYPE.TEXT || type === GROUP_TYPE.STATIC ? RESULT_DISPLAY_FORMAT.HTML : ""),
                        hashImportedImage: hashImportedImage || undefined,
                    };

                    groups.set(group.id, group);

                    const groupElement = addGroupElement(group.type, group.id);

                    const groupNameElement = groupElement.querySelector(".group-name");
                    const dataElement = groupElement.querySelector(".data-text");

                    // Break groups elements don't have data and transform elements
                    if (groupNameElement) groupNameElement.value = group.name;
                    if (dataElement) dataElement.value = group.data;

                    if (group.type === GROUP_TYPE.IMPORTED_IMAGE && group.hashImportedImage) {

                        const urlEncodedHash = encodeURIComponent(group.hashImportedImage);

                        const imageUrl = `/imported-image/${urlEncodedHash}`

                        try {
                            const response = await fetchWithCheck(imageUrl);

                            if (!response.ok) {

                                const errorData = await response.json();

                                if (response.status === 400 || response.status === 404) {

                                    displayAlert(
                                        {
                                            issue: `Error loading image ${group.name}`,
                                            action: `Import a new image in the group`,
                                            variant: "warning",
                                            icon: "exclamation-octagon",
                                            duration: 3000
                                        }
                                    );
                                }

                                throw new Error(`HTTP status ${response.status}, ${errorData.error}`);
                            }

                            const resultBuffer = await response.arrayBuffer();

                            console.log(`Received image result buffer`);

                            const contentType = response.headers.get('Content-Type');

                            const blob = new Blob([resultBuffer], { type: contentType });

                            const blobUrl = URL.createObjectURL(blob);
                            console.log("[IMPORTED IMAGE] URL for the image ", blobUrl);

                            const resultElement = groupElement.querySelector("img.result");
                            const functionButtonsContainer = groupElement.querySelector(".function-buttons-container");

                            resultElement.src = blobUrl;
                            resultElement.style.display = 'block';
                            functionButtonsContainer.style.display = 'flex';

                            // Event listener for image click to toggle zoom in and out
                            resultElement.removeEventListener('click', createZoomedImage);
                            resultElement.addEventListener('click', createZoomedImage);

                            group.result = blob;
                            group.resultBlobURI = blobUrl;
                            console.log("[IMPORTED IMAGE] Added to group's result")

                        } catch (error) {
                            console.error(`Fetching image for immported image group ${group.name} failed: ${error} `);
                        }
                    }

                    // Set the group UI buttons in the right state, reflecting the saved settings for the group

                    // display the right UI state based on the interactionState and ownership/authorship of the app
                    displayGroupInteractionState(groupElement, group.interactionState);

                    displayTextGroupDisplayFormatButtons(groupElement, group.resultDisplayFormat)

                    displayControlnetStatus(groupElement, group.controlnetEnabled);

                }
            )
        );
    } catch (error) {

        console.error("[LOADING] Error loading groups", error);

        return createBlankApp();
    }

    if (!ID && importedGroups) { persistGroups(groups); }

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

        ID = "";

        history.pushState(groups, "", "/app");

        // we are interested in having even this first isolated node in the graph
        // as we will use it in the updateGroups function
        const isUsedByGraph = updateReferenceGraph(groups);

        return { groups, isUsedByGraph };
    }
}

function downloadEsquisseJson(groups) {

    const packagedGroups = packageGroups(groups, { packageIds: false });

    const jsonData = JSON.stringify(packagedGroups);

    if (!arePackagedGroupsValid()) {
        displayAlert(
            {
                issue: "Failed to create a valid file",
                action: "Refresh the page and download the app file again",
                variant: "warning"
            }
        );
        console.log("[IMPORTING APP] Invalid json: ", validationResult)
        return;
    }

    const blob = new Blob([jsonData], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    const appName = groups.values().next().value?.name ? groups.values().next().value.name : 'Unnamed App';

    a.download = `${appName}.esquisse.json`;
    a.click();

    URL.revokeObjectURL(url);
}

async function handleEsquisseJsonUpload(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        try {
            const jsonData = JSON.parse(text);

            if (!arePackagedGroupsValid()) {
                displayAlert(
                    {
                        issue: "Files is not a valid .esquisse.json",
                        action: "Use a file downloaded from an app",
                        variant: "warning"
                    }
                );
                console.log("[IMPORTING APP] Invalid json: ", validationResult)
                return;
            }

            loadGroups(jsonData);

        } catch (error) {
            console.error("Error parsing JSON file", error);
        }
    };
    reader.readAsText(file);
}

function arePackagedGroupsValid(jsonData) {
    const validator = new Validator.Validator();
    const validationResult = validator.validate(jsonData, PACKAGED_GROUPS_SCHEMA);
    return validationResult.valid;
}

async function shareResult(groups, ShareButtonElement) {

    ShareButtonElement.classList.remove("error");
    ShareButtonElement.classList.add("waiting");
    const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
    fetchingIndicatorElement.classList.add("waiting");

    const thumbnailBlob = await captureThumbnail();

    const result = await packageResult(groups, thumbnailBlob);

    if (window.DEBUG) {
        const jsonData = JSON.stringify(result);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${groups.values().next().value.name} - esquisse-result.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const resultid = await persistResultOnServer(result);

    if (resultid) {
        const protocol = window.location.protocol;
        const host = window.location.host;
        const url = protocol + "//" + host + "/result/" + resultid

        displayAlert({
            issue: "Result ready to share!",
            action: `<a href = "${url}" target = "_blank" > Link to your result</a> `,
            variant: "success",
            icon: "file-earmark-arrow-up",
            duration: Infinity
        })
    }
    else {
        displayAlert({
            issue: "Couldn't save your result",
            action: `Check your connection`,
            variant: "danger",
            icon: "file-earmark-arrow-up",
            duration: 3000
        })

    }

    ShareButtonElement.classList.remove("waiting");
    removeGlobalWaitingIndicator();
}

// Packaged result fields are not guaranteed to be sent to the server:
// The persist function pick what it sends.
async function packageResult(groups, thumbnail) {
    let packagedGroupsResults = {};

    if (thumbnail && thumbnail.type === "image/jpeg") {
        packagedGroupsResults.thumbnail = await fileToBase64(thumbnail)
    }
    packagedGroupsResults.version = VERSION;
    packagedGroupsResults.appid = ID;
    packagedGroupsResults.appversiontimestamp = APP_VERSION_TIMESTAMP;
    // username and resultid are added server-side

    // Convert the Map's values to an array and sort them based on their index property
    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.index - b.index);

    // Replacing blobURIs with a custom esquisse result reference locator

    // First build up a replacement map for in-result blob URIs
    let replacementMap = new Map();

    sortedGroups.forEach(group => {

        if (group.resultBlobURI) {
            replacementMap.set(group.name, group.resultBlobURI)
        }
    });

    // then do another pass to actually replace the blob URIs
    sortedGroups.forEach(group => {
        const hasTextResult = (group.type === GROUP_TYPE.TEXT || group.type === GROUP_TYPE.STATIC) && group.result;

        if (hasTextResult) {
            replacementMap.forEach((value, key) => {
                group.result = group.result.replaceAll(value, `esquisse:result/${key}`);
            });
        }
    });

    // we store the groups array in the groups property
    const groupsResultsPromises = sortedGroups.map(

        async ({ name, type, result }) => {

            const isResultAnImage =
                result
                && result.type
                && result.type.startsWith("image/")
                && (type === GROUP_TYPE.IMAGE || type === GROUP_TYPE.IMPORTED_IMAGE);

            if (isResultAnImage) {
                result = await fileToBase64(result)
            }
            return { name, type, result }
        }
    );

    packagedGroupsResults.groups = await Promise.all(groupsResultsPromises);

    return packagedGroupsResults;
}

async function persistResultOnServer(packagedResult) {

    console.log("[PERSIST] Persist result on server", packagedResult);

    try {
        const response = await fetchWithCheck('/persist-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                {
                    groups: packagedResult.groups,
                    version: packagedResult.version,
                    appid: packagedResult.appid,
                    appversiontimestamp: packagedResult.appversiontimestamp,
                    thumbnail: packagedResult.thumbnail,
                }
            ),
        });

        if (!response.ok) {
            throw new Error(response);
        }

        const { resultid } = await response.json();

        console.log("[PERSIST] result id sent by server", resultid);

        return resultid;

    } catch (error) {
        console.error("Error in persisting result", error.body);
    }
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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.replace('data:', '').replace(/^.+,/, '');
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


function throttle(func, timeFrame, overrideThreshold, setGlobal) {
    let lastTime = 0;
    let callSkippedCounter = 0;
    setGlobal(callSkippedCounter);
    return function (...args) {
        let now = new Date();

        if (callSkippedCounter > overrideThreshold) {
            // Reset skipped calls counter and invoke the function
            callSkippedCounter = 0;
            setGlobal(callSkippedCounter);
            func(...args);
            lastTime = now;
        } else if (now - lastTime >= timeFrame) {
            // Regular throttling behavior
            func(...args);
            lastTime = now;
        } else {
            // Increment the skipped calls counter
            callSkippedCounter++;
            setGlobal(callSkippedCounter);
        }
    };
}
