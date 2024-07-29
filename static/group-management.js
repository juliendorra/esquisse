import { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateGroupUUID, generateUniqueGroupName } from "./group-utils.js";

import Graph from "https://cdn.jsdelivr.net/npm/graph-data-structure@3.5.0/+esm";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.2/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm";

import { displayAlert, resizeTextArea, createZoomedIframe } from "./ui-utils.js";

import { nameChangeHandler, handleInputChange, handleListSelectionChange, handleImportedImage, handleDroppedImage, hashAndPersist, clearImportedImage } from "./input-change.js";
import { onDragStart, onDragEnd } from "./reordering.js";
import { referencesGraph, updateReferenceGraph } from "./reference-graph.js";

import { persistGroups, getAppMetaData } from "./persistence.js";
import { startWebcam, stopWebcam, switchWebcam, captureAndHandle, flipImageResult } from "./webcam.js";

import { onInput, handleKeyNavigation } from './autocomplete.js';

const BASE_CSS_FOR_IFRAME_RESULT = "/styleiframebase.css"

const groupsMap = {
    GROUPS: new Map(),
};

// this map hold the unresolved promises 
let ONGOING_UPDATES = new Map();

export {
    groupsMap,

    createGroupInLocalDataStructures,
    addGroupElement, createGroupAndAddGroupElement, addEventListenersToGroup, deleteGroup,

    displayAllGroupsInteractionState, displayGroupInteractionState, displayControlnetStatus, displayTextGroupDisplayFormatButtons,

    updateGroups, updateGroupsReferencingIt,

    displayCombinedReferencedResult, displayDataText, displayDataTextReferenceStatus, displayFormattedResults,

    indexGroupsInNewOrder,

    getGroupNamesForAutocomplete,
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
            
            <div class="data-text-container">
                <textarea class="data-text auto-complete" placeholder="Data you want to use: text, #name or [another name] to get results from another block"></textarea>
                <div class="referenced-result-text" placeholder="Referenced Result"></div>
            </div>

            <div class="function-buttons-container">

                <div class="group-btn">
                <button class="tool-btn html-mode-btn" aria-label="HTML mode"><img src="/icons/html-mode.svg"></button>
                <button class="tool-btn text-mode-btn" aria-label="text mode"><img src="/icons/text-mode.svg"></button>
                <button class="tool-btn list-mode-btn"><img alt="List mode" src="/icons/list-mode.svg"></button>
                </div>
            
                <button class="tool-btn entry-btn" aria-label="Entry"><img src="/icons/entry.svg"></button>

            </div>

           <iframe class="result empty-result" sandbox="allow-same-origin" style="display:none;"></iframe>
           <button class="tool-btn zoom-out-btn" aria-label="Zoom Out"><img src="/icons/zoom-out.svg"></button>
           <div class="result-placeholder"><span></span><span></span><span></span><span></span><span></span><span></span></div>
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
                <div class="video-zone" style="display:none;"> 
                <video class="webcam-feed" autoplay muted playsinline></video>
                <div class="webcam-capture-interval-indicator"></div>
                <div class="device-selection" style="display:none;">
                    <sl-select aria-label="Select a camera" placeholder="Select a camera" size="small">
                    </sl-select>
                </div>
            </div>
                
            </div>
            <div class="function-buttons-container">

                <button class="tool-btn capture-webcam-frame-btn" aria-label="Capture webcam frame" style="display:none;"><img src="/icons/capture-webcam-frame.svg"></button>

                <button class="tool-btn mirror-btn" aria-label="Mirror" style="display:none;"><img src="/icons/mirror.svg"></button>

                <button class="tool-btn stop-webcam-btn" aria-label="Stop webcam" style="display:none;"><img src="/icons/stop-webcam.svg"></button>

                <button class="tool-btn start-webcam-btn" aria-label="Start webcam"><img src="/icons/start-webcam.svg"></button>

                <button class="tool-btn entry-btn" aria-label="Entry"><img src="/icons/entry.svg"></button>
                
                <button class="tool-btn clear-btn" aria-label="Clear" ><img src="/icons/clear.svg"></button>
                </div>
            </div>

            <img class="result"  alt="Imported image"  style="display:none;">
            <div class="result-placeholder"></div>
            `,


    TEXT: `
            <div class="group-header">
                <small><img src="/icons/text-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this block">

            <div class="data-text-container">
                <textarea class="data-text auto-complete" placeholder="Data you want to use: text, #name or [another name] to get results from another block"></textarea>
                <div class="referenced-result-text" placeholder="Referenced Result"></div>
            </div>

            <div class="function-buttons-container">

                <div class="group-btn">
                <button class="tool-btn html-mode-btn" aria-label="HTML mode"><img src="/icons/html-mode.svg"></button>
                <button class="tool-btn text-mode-btn" aria-label="text mode"><img src="/icons/text-mode.svg"></button>
                <button class="tool-btn list-mode-btn"><img alt="List mode" src="/icons/list-mode.svg"></button>
                </div>

                <button class="tool-btn refresh-btn" aria-label="Refresh"><img src="/icons/refresh.svg"></button>
            </div>

           <iframe class="result empty-result" sandbox="allow-same-origin" style="display:none;"></iframe>
           <button class="tool-btn zoom-out-btn" aria-label="Zoom Out"><img src="/icons/zoom-out.svg"></button>
           <div class="result-placeholder"><span></span><span></span><span></span><span></span><span></span><span></span></div>
            `,

    IMAGE: `
            <div class="group-header">
                <small><img src="/icons/image-gen.svg"></small>
                <div class="drag-handle">···</div>
                <button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
            </div>

            <input type="text" class="group-name" placeholder="Name of this Block">

            <div class="data-text-container">
                <textarea class="data-text auto-complete" placeholder="Data you want to use: visual keywords, #name or [another name] to get results from another block"></textarea>
                <div class="referenced-result-text" placeholder="Referenced Result"></div>
            </div>

            <div class="function-buttons-container">

                <div class="group-btn">
                <button class="tool-btn image-to-image-btn" aria-label="Image to image"><img src="/icons/image-to-image.svg"></button>
                <button class="tool-btn controlnet-btn" aria-label="Controlnet"><img src="/icons/controlnet.svg"></button>
                </div>

                <button class="tool-btn refresh-btn" aria-label="Refresh"><img src="/icons/refresh.svg"></button>
            </div>

            <img class="result"  alt="Generated image"  style="display:none;">
            <div class="result-placeholder"></div>

            <a class="tool-btn download-btn" aria-label="Download"><img src="/icons/download.svg"></a>
            `,

};

function createGroupInLocalDataStructures(groupType) {

    const groups = groupsMap.GROUPS;

    const id = generateGroupUUID();
    const name = generateUniqueGroupName(groupType, groups);

    console.log("[CREATING NEW GROUP] groups are already ", groups.size);

    const group = {
        // these properties are persisted
        id: id,
        name: name,
        data: "",
        transform: "",
        type: groupType,
        result: "",
        hashImportedImage: "",
        interactionState: INTERACTION_STATE.OPEN,

        // properties below are used client side but not persisted
        index: groups.size,
        resultDisplayFormat: (groupType === GROUP_TYPE.TEXT || groupType === GROUP_TYPE.STATIC) ? RESULT_DISPLAY_FORMAT.HTML : "",
        webcamEnabled: false,
        resultBlobURI: "",
        resultHash: "",
        referenceHashes: new Map(),
        hasReferences: false,
        availableReferencedResults: [], //[{ name, result, type, resultHash },..} 
        combinedReferencedResults: [],
        // used by displayFormattedResults function
        savedResult: "",
        listItems: [],
    };

    console.log("[CREATING NEW GROUP] New group in data:", group);

    groups.set(group.id, group);

    // we need this new isolated group in the graph
    // as the graph is used by the updateGroups function
    updateReferenceGraph(groups);

    return groups.get(group.id);
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

    // Initially set result display mode to html 
    const htmlModeButton = groupElement.querySelector(".html-mode-btn");
    if (htmlModeButton) {
        htmlModeButton.classList.add("selected");
    }

    // Initially set image to image button to selected
    const imageToImageButton = groupElement.querySelector(".image-to-image-btn");
    if (imageToImageButton) {
        imageToImageButton.classList.add("selected");
    }

    // Initially hide the download button
    const downloadButton = groupElement.querySelector(".download-btn");
    if (downloadButton) {
        downloadButton.style.display = 'none';
    }

    const container = document.querySelector(".container");
    container.appendChild(groupElement);

    addEventListenersToGroup(groupElement);

    groupNameElement.focus();
    groupNameElement.select();

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
    const refResultElement = groupElement.querySelector(".referenced-result-text");

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

    // Persist and handle change when a group's name, data changes

    groupNameElement?.addEventListener("change", () => { nameChangeHandler(group, groupNameElement, groups); });

    let dataTextHasChangedWithoutBeingHandled = false;

    dataElement?.addEventListener('change',
        () => {

            console.log("[DATA ELEMENT EVENT] change", group.name);

            dataTextHasChangedWithoutBeingHandled = true;

            const dropdown = groupElement.querySelector(".autocomplete-selector");

            if (dropdown && dropdown.open) {
                return;
            }

            handleInputChange(groupElement, true, false, true, groups);
            dataTextHasChangedWithoutBeingHandled = false;
        });


    dataElement?.addEventListener("blur", () => {

        console.log("[DATA ELEMENT EVENT] blur", group.name);

        const dropdown = groupElement.querySelector(".autocomplete-selector");

        if (dropdown && dropdown.open) {
            return;
        }

        // emit the change again if it wasn't handled
        if (dataTextHasChangedWithoutBeingHandled) {
            const changeEvent = new Event('change', {
                bubbles: true,
                cancelable: true,
            });
            dataElement.dispatchEvent(changeEvent);
        }

        if (refResultElement) {
            refResultElement.style.display = "block";
            dataElement.style.display = "none";
        }
    });

    // Handling the toggle between combined referenced results and data text input 

    if (refResultElement) {

        // Mousedown gives us an immediate feedback of focusing data input when starting a click anywhere in the data input element, except inside a rendered result iframe.
        // It's useful because it avoids the mentally surprising experience of instinctively selecting a text in the rendered referenced results and loosing the selection when the pointer button is released

        refResultElement.addEventListener("mousedown", () => {
            refResultElement.style.display = "none";
            dataElement.style.display = "block";
            // Delay focusing on the dataElement until the next event loop cycle
            // to avoid a focus then immediate blur of dataElement during the mousedown cycle
            setTimeout(() => {
                dataElement.focus();
            }, 0);
        });

        // Click, in turn, focus the data input textArea when clicking anywhere, including a rendered result iframe, giving us an acceptable fallback for these cases

        refResultElement.addEventListener("click", () => {
            refResultElement.style.display = "none";
            dataElement.style.display = "block";
            dataElement.focus();
        });

        dataElement?.addEventListener("focus", () => {
            dataElement.style.display = "block";
            refResultElement.style.display = "none";
        });
    }

    const container = document.querySelector('.container');

    // Autoadjusting the size of textAreas
    dataElement?.addEventListener("input", () => {
        if (container && container.classList.contains('list-view')) {
            resizeTextArea(dataElement)
        }
    });


    // Navigating throught the text fields 

    // 1. using shift|fn + return|enter
    // We handle 3 kind of enter : 
    // event.key === 'Enter' => Enter, Return, fn + Return, Shift+Enter…
    // event.code === 'NumpadEnter'  =>  true Enter key and fn + Return on Mac
    // event.key === 'Enter' && event.shiftKey  => any enter key including return on Mac in combination with shift
    // note that the return key on mac emit an enter key in the browser

    // 2. we also skip to the next input field when :
    // - user cursor is positioned at the end of a data or transform textArea. 
    // - There's already an empty line at the end
    // - user type key=enter

    groupNameElement?.addEventListener("keydown", (event) => {

        // any kind of enter will skip in the name input
        if (event.key === 'Enter') {
            event.preventDefault();
            if (dataElement) {
                dataElement.focus();
            } else {
                focusOnNextElement(groupElement, ".group-name");
            }
        }
    });

    dataElement?.addEventListener("keydown", (event) => {
        const dontLineReturn = event.code === 'NumpadEnter' || (event.shiftKey && event.key === 'Enter');

        if (event.key === 'Enter' && isCursorAtEndWithTwoEmptyLines(dataElement)) {
            event.preventDefault();
            if (transformElement) {
                transformElement.focus();
            } else {
                focusOnNextElement(groupElement, ".group-name");
            }
        } else if (dontLineReturn) {
            event.preventDefault();
            if (transformElement) {
                transformElement.focus();
            } else {
                focusOnNextElement(groupElement, ".group-name");
            }
        }
    });

    const autocompleteElements = groupElement.querySelectorAll(".auto-complete");
    for (const element of autocompleteElements) {
        element.addEventListener('input', onInput);
        element.addEventListener('keydown', handleKeyNavigation);
    }


    function isCursorAtEndWithTwoEmptyLines(textarea) {
        const value = textarea.value;
        const cursorPosition = textarea.selectionStart;
        const isAtEnd = cursorPosition === value.length;
        const endsWithTwoEmptyLines = value.endsWith("\n\n") || value === "\n";
        return isAtEnd && endsWithTwoEmptyLines;
    }

    function focusOnNextElement(currentGroupElement, firstSelector) {
        const nextGroup = currentGroupElement.nextElementSibling;
        if (nextGroup) {
            let nextElement = nextGroup.querySelector(firstSelector);
            if (nextElement) {
                nextElement.focus();
            }
        } else {
            // Check if current group is the last group
            const container = document.querySelector(".container");
            const lastGroupElement = container.lastElementChild;
            if (currentGroupElement === lastGroupElement) {
                const currentGroupType = getGroupTypeFromElement(currentGroupElement);
                const newGroupElement = createGroupAndAddGroupElement(currentGroupType);
                let nextElement = newGroupElement.querySelector(firstSelector);
                if (nextElement) {
                    nextElement.focus();
                }
            }
        }
    }

    function getGroupTypeFromElement(groupElement) {
        const groupId = getGroupIdFromElement(groupElement);
        const group = groupsMap.GROUPS.get(groupId);
        return group ? group.type : GROUP_TYPE.TEXT; // Default to TEXT if group is not found
    }


    // Event listeners for imported image groups

    if (group.type === GROUP_TYPE.IMPORTED_IMAGE) {

        const dropZone = groupElement.querySelector(".drop-zone");

        groupElement.addEventListener("dragover", event => {
            event.preventDefault();
            event.stopPropagation();
            dropZone?.classList.add("drop-zone-over");
        });

        groupElement.addEventListener("dragleave", event => {
            event.preventDefault();
            event.stopPropagation()
            dropZone?.classList.remove("drop-zone-over");
        });

        dropZone?.addEventListener(
            'click',
            (event) => { handleImportedImage(group, groupElement) }
        );

        groupElement.addEventListener(
            'drop',
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                dropZone?.classList.remove("drop-zone-over");

                const imageFile = event.dataTransfer.files[0];

                handleDroppedImage(imageFile, groupElement)
            }
        );

        /******** Webcam buttons *************/

        const startWebcamButton = groupElement.querySelector('.start-webcam-btn');
        const stopWebcamButton = groupElement.querySelector('.stop-webcam-btn');
        const captureWebcamFrameButton = groupElement.querySelector('.capture-webcam-frame-btn');
        const webcamFeed = groupElement.querySelector('.webcam-feed');
        const mirrorButton = groupElement.querySelector('.mirror-btn');

        startWebcamButton?.addEventListener('click', async (event) => {

            group.webcamEnabled = true;

            console.log("[WEBCAM MODE] enabled ", group.webcamEnabled)

            startWebcam(groupElement, undefined);
        });

        groupElement.querySelector('.device-selection sl-select')?.addEventListener('sl-change', event => {
            const selectedDeviceId = event.currentTarget.value;
            switchWebcam(groupElement, selectedDeviceId);
        });

        stopWebcamButton?.addEventListener('click', (event) => {

            group.webcamEnabled = false;

            console.log("[WEBCAM MODE] enabled ", group.webcamEnabled)

            stopWebcam(groupElement)
        });

        webcamFeed?.addEventListener('click', async (event) => {

            console.log("[WEBCAM MODE] manually capturing a frame");

            if (!group.webcamEnabled) {
                return;
            }
            else {
                await captureAndHandle(groupElement);
            }

        });

        captureWebcamFrameButton?.addEventListener('click', async (event) => {

            console.log("[WEBCAM MODE] manually capturing a frame");

            // the event target is lost after calling captureAndHandle, so we keep a reference
            const thisButton = event.currentTarget;

            if (!group.webcamEnabled) {
                return;
            }
            else {
                thisButton.classList.add("selected");
                await captureAndHandle(groupElement);
                setTimeout(() => {

                    thisButton.classList.remove("selected");

                }, 300);
            }

        });

        mirrorButton?.addEventListener('click', async (event) => {

            console.log("[WEBCAM MODE] toggling mirror");

            // the event target is lost after calling captureAndHandle, so we keep a reference
            const thisButton = event.currentTarget;

            if (thisButton.classList.contains("selected")) {
                thisButton.classList.remove("selected");
                groupElement.classList.remove("mirrored-video");
                flipImageResult(groupElement);
            }
            else {
                thisButton.classList.add("selected");
                groupElement.classList.add("mirrored-video");
                flipImageResult(groupElement);
            }

        });
    }

    /******** Tool buttons *************/
    groupElement.querySelector(".delete-btn").addEventListener("click", () => deleteGroup(groupElement));


    groupElement.querySelector(".html-mode-btn")?.addEventListener("click", (event) => {

        setGroupResultDisplayFormat(groupElement, RESULT_DISPLAY_FORMAT.HTML);

        displayTextGroupDisplayFormatButtons(groupElement, group.resultDisplayFormat);

        displayFormattedResults(groupElement);
        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".text-mode-btn")?.addEventListener("click", (event) => {

        setGroupResultDisplayFormat(groupElement, RESULT_DISPLAY_FORMAT.TEXT);

        displayTextGroupDisplayFormatButtons(groupElement, group.resultDisplayFormat);

        displayFormattedResults(groupElement);
        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".list-mode-btn")?.addEventListener("click", (event) => {

        setGroupResultDisplayFormat(groupElement, RESULT_DISPLAY_FORMAT.LIST);

        displayTextGroupDisplayFormatButtons(groupElement, group.resultDisplayFormat);

        displayFormattedResults(groupElement);
        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".image-to-image-btn")?.addEventListener("click", (event) => {
        group.controlnetEnabled = false;

        displayControlnetStatus(groupElement, group.controlnetEnabled)

        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".controlnet-btn")?.addEventListener("click", (event) => {
        group.controlnetEnabled = true;

        displayControlnetStatus(groupElement, group.controlnetEnabled)

        persistGroups(groupsMap.GROUPS);
    });

    groupElement.querySelector(".entry-btn")?.addEventListener("click", async (event) => {

        const previousInteractionState = group.interactionState;

        group.interactionState = group.interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.OPEN : INTERACTION_STATE.ENTRY;

        displayGroupInteractionState(groupElement, group.interactionState);

        if (group.type === GROUP_TYPE.IMPORTED_IMAGE && previousInteractionState === INTERACTION_STATE.ENTRY && INTERACTION_STATE.OPEN) {
            group.hashImportedImage = await hashAndPersist(group.interactionState, group.result)
        }

        persistGroups(groups);
    });


    groupElement.querySelector(".refresh-btn")?.addEventListener("click", () => handleInputChange(groupElement, true, true, true, groups));

    groupElement.querySelector(".clear-btn")?.addEventListener("click", () => clearImportedImage(group, groupElement));

    // Result buttons

    groupElement.querySelector(".zoom-out-btn")?.addEventListener("click", (event) => {
        const resultElement = groupElement.querySelector("iframe.result");
        createZoomedIframe(resultElement);
    });

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

function displayAllGroupsInteractionState() {

    groupsMap.GROUPS

    const groupElements = document.querySelectorAll('.container .group');

    for (const groupElement of groupElements) {

        const id = groupElement.getAttribute('data-id');

        const interactionState = groupsMap.GROUPS.get(id).interactionState;

        displayGroupInteractionState(groupElement, interactionState);
    }
}

function displayTextGroupDisplayFormatButtons(groupElement, resultDisplayFormat) {

    const htmlModeButton = groupElement.querySelector(".html-mode-btn");
    const textModeButton = groupElement.querySelector(".text-mode-btn")
    const listModeButton = groupElement.querySelector(".list-mode-btn")


    switch (resultDisplayFormat) {
        case RESULT_DISPLAY_FORMAT.HTML:
            htmlModeButton?.classList.add("selected")
            textModeButton?.classList.remove("selected")
            listModeButton?.classList.remove("selected")
            break;
        case RESULT_DISPLAY_FORMAT.TEXT:
            htmlModeButton?.classList.remove("selected")
            textModeButton?.classList.add("selected")
            listModeButton?.classList.remove("selected")
            break;
        case RESULT_DISPLAY_FORMAT.LIST:
            htmlModeButton?.classList.remove("selected")
            textModeButton?.classList.remove("selected")
            listModeButton?.classList.add("selected")
            break;
    }
}

function displayGroupInteractionState(groupElement, interactionState) {
    const groupNameElement = groupElement.querySelector(".group-name");
    const dataElement = groupElement.querySelector(".data-text");

    const entryButton = groupElement.querySelector(".entry-btn");

    const { CREATOR, USERNAME, ID } = getAppMetaData();

    const userIsAppAuthor = CREATOR === USERNAME || ID === null;

    let interactionStateAfterAuthorCheck

    if (userIsAppAuthor) {
        interactionStateAfterAuthorCheck = interactionState
    }
    else {
        interactionStateAfterAuthorCheck = interactionState === INTERACTION_STATE.ENTRY ? INTERACTION_STATE.ENTRY : INTERACTION_STATE.LOCKED
    }

    switch (interactionStateAfterAuthorCheck) {
        case INTERACTION_STATE.OPEN:
            groupElement.classList.remove("entry");

            groupNameElement?.removeAttribute("readonly");
            dataElement?.removeAttribute("readonly");

            entryButton?.classList.remove("selected")
            break;

        case INTERACTION_STATE.ENTRY:
            if (userIsAppAuthor) {
                groupNameElement?.removeAttribute("readonly");

                const group = getGroupFromName(groupNameElement.value, groupsMap.GROUPS);

                if (group.result) {
                    let message;

                    if (group.type === GROUP_TYPE.STATIC && group.hasReferences) {
                        message = "References and text won't be saved";
                    }
                    else if (group.type === GROUP_TYPE.STATIC) {
                        message = "Text entered won't be saved";
                    }
                    else if (group.type === GROUP_TYPE.IMPORTED_IMAGE) {
                        message = "The imported image won't be saved";
                    }
                    else {
                        message = "Data won't be saved";
                    }

                    displayAlert(
                        {
                            issue: `${group.name} is set as an user input block`,
                            action: message,
                            variant: "warning",
                            icon: "exclamation-octagon",
                            duration: 5000
                        }
                    );
                }

            }
            else {
                groupNameElement?.setAttribute("readonly", "readonly");
            }

            groupElement.classList.add("entry");
            dataElement?.removeAttribute("readonly");

            entryButton?.classList.add("selected")
            break;

        case INTERACTION_STATE.LOCKED:
            groupElement.classList.remove("entry");

            groupNameElement?.setAttribute("readonly", "readonly");
            dataElement?.setAttribute("readonly", "readonly");

            entryButton?.classList.remove("selected")
            break;
    }
}

function displayControlnetStatus(groupElement, controlnetEnabled) {

    const controlnetButton = groupElement.querySelector(".controlnet-btn");
    const imageToImageButton = groupElement.querySelector(".image-to-image-btn");

    if (controlnetButton && controlnetEnabled) {
        controlnetButton.classList.add("selected");
        imageToImageButton.classList.remove("selected");
    }
    else if (controlnetButton) {
        controlnetButton.classList.remove("selected");
        imageToImageButton.classList.add("selected");
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

function displayCombinedReferencedResult(groupElement, itemizedDataText) {

    const referencedResultText = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    if (referencedResultText && itemizedDataText.length > 0) {
        console.log(`[DISPLAY COMBINED REFS] Displaying the results referenced for ${dataText.value}`, itemizedDataText);

        referencedResultText.innerHTML = '';

        for (const item of itemizedDataText) {
            let element;

            console.log("DISPLAY COMBINED REFS] next item is ", item);

            if (item.isReference) {
                if (item.contentType === 'IMAGE' && item.isValid && item.isReady) {

                    element = document.createElement('img');
                    element.classList.add('inline-result-image');
                    element.dataset.name = item.name;

                    referencedResultText.appendChild(element);

                    console.log(`[DISPLAY COMBINED REFS] Image, inserting ${item.resultToInsert} as `);

                    renderInImg(element, item.resultToInsert);

                } else if (item.contentType === 'HTML' && item.isValid && item.isReady) {

                    element = document.createElement('iframe');
                    const groupTypeClassName = item.groupType === GROUP_TYPE.TEXT ? "text" : "static";

                    element.classList.add("inline-result-html", groupTypeClassName);
                    element.dataset.name = item.name;

                    // appending the iframe first, if we don't the iframe document is null 
                    referencedResultText.appendChild(element);

                    renderInIframe({
                        targetIframe: element,
                        content: item.resultToInsert,
                        format: RESULT_DISPLAY_FORMAT.HTML,
                        scale: 0.7,
                        margin: "2", // will be applied in rem
                    });

                    // A valid reference but the result is not ready
                } else if (item.isValid && !item.isReady) {

                    element = document.createElement('span');
                    element.classList.add("inline-reference-text", "not-ready");
                    element.dataset.name = item.name;

                    referencedResultText.appendChild(element);

                    renderInSpan(element, item.name);

                } else if (!item.isValid) {

                    console.log("INVALID REFERENCE", item.name, "Result", item.resultToInsert)

                    element = document.createElement('span');
                    element.classList.add("inline-reference-text", "not-valid");
                    element.dataset.name = item.name;

                    referencedResultText.appendChild(element);

                    renderInSpan(element, item.resultToInsert);
                }
            } else if (item.contentType === "TEXT") {

                element = document.createElement('span');
                element.classList.add("inline-data-text");
                element.dataset.name = item.name;

                referencedResultText.appendChild(element);

                renderInSpan(element, item.resultToInsert);
            }
        }
        referencedResultText.style.display = "block";
        dataText.style.display = "none";
    }
    else if (referencedResultText) {
        referencedResultText.style.display = 'none';
        dataText.style.display = "block";
    }
    else {
        console.log("[DISPLAY COMBINED REFS] No element to display the combined refs!");
    }

}

function displayDataText(groupElement) {
    const refResultTextarea = groupElement.querySelector(".referenced-result-text");
    const dataText = groupElement.querySelector(".data-text");

    console.log("[DISPLAY] Displaying the group data text, probably because no references exist or match");

    if (refResultTextarea) {
        refResultTextarea.style.display = "none";
    }

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
    refResultTextarea?.classList.remove('error', 'warning', 'valid');

    if (hasReferences) {
        if (
            invalidReferencedResults.length > 0
            && notreadyReferencedResults.length === 0
            && availableReferencedResults.length === 0
        ) {
            dataTextElement.classList.add('error');
            refResultTextarea?.classList.add('error');
        }
        else if (
            invalidReferencedResults.length > 0
            && (notreadyReferencedResults.length > 0 || availableReferencedResults.length > 0)
        ) {
            dataTextElement.classList.add('warning');
            refResultTextarea?.classList.add('warning');
        }
        else if (
            invalidReferencedResults.length === 0
            && (notreadyReferencedResults.length > 0 || availableReferencedResults.length > 0)
        ) {
            dataTextElement.classList.add('valid');
            refResultTextarea?.classList.add('valid');
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

        // We treat a new list as a selection change, so the result is updated accorfing to the new list default selection
        handleListSelectionChange(selectElement, group, group.listItems);

        selectElement.addEventListener(
            "sl-change",
            (event) => {
                handleListSelectionChange(selectElement, group, group.listItems);
            });

        resultElement.after(selectElement);

    }
    else if (!group.resultDisplayFormat || group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.TEXT || group.resultDisplayFormat === RESULT_DISPLAY_FORMAT.HTML) {

        const existingSlSelect = groupElement.querySelector("sl-select");

        if (existingSlSelect) {
            group.result = group.savedResult;
            group.listItems = [];
            existingSlSelect.remove();
        }

        renderInIframe({
            targetIframe: resultElement,
            content: group.result,
            format: group.resultDisplayFormat,
            scale: 1,
            margin: "0",
        });

        if (group.result) {
            resultElement.classList.remove("empty-result");
            resultElement.style.display = 'block';
        }
        else {
            resultElement.classList.add("empty-result");
            resultElement.style.display = 'none';
        }
    }
}
// margin will be applied in rem
function renderInIframe({ targetIframe, content, format = RESULT_DISPLAY_FORMAT.HTML, scale = 1, margin = "0" }) {

    console.log("[RENDERING IFRAME] ", targetIframe);

    // Allow specific protocols handlers in URL attributes via regex (default is false, be careful, XSS risk)
    // By default only http, https, ftp, ftps, tel, mailto, callto, sms, cid and xmpp are allowed.
    // We add blob to display local images
    const sanitizeOptions = {
        ALLOWED_URI_REGEXP: /^(?:(?:ftp|http|https|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    };


    let finalHTML;

    if (format === RESULT_DISPLAY_FORMAT.TEXT) {

        const sanitizedHTML = DOMPurify.sanitize(content, sanitizeOptions);

        finalHTML = sanitizedHTML
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }
    else if (format === RESULT_DISPLAY_FORMAT.HTML) {

        // useful because instruct LLMs tend to return markdown formatted answers 
        const marked = new Marked();
        const parsedForMarkdown = marked.parse(content, { breaks: true, });

        const sanitizedHTML = DOMPurify.sanitize(parsedForMarkdown, sanitizeOptions);

        finalHTML = sanitizedHTML;
    }

    const iFrameHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" type="text/css" href="${BASE_CSS_FOR_IFRAME_RESULT}">
        <style>
            body{
                transform-origin: top left; 
                transform: scale(${scale}); 
                width: calc((100% / ${scale}) - (2 * ${margin}rem));
                height: calc(100% / ${scale});
                margin-left: ${margin}rem;
            }
        </style>
        <title>Result</title>
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; img-src 'self' blob:;">
    </head>
    <body>
        ${finalHTML}
    </body>
    </html>
`;

    // listening and re-emiting to the clicks inside the iFrame
    // we ensure the event is attached after the iframe content has fully loaded

    targetIframe.onload = function () {
        const iframeWindow = targetIframe.contentWindow;

        iframeWindow.addEventListener(
            'click',
            () => {
                const eventOut = new CustomEvent('click', {
                    bubbles: true,
                    cancelable: false
                });

                // Dispatch the event on the iframe element itself
                targetIframe.dispatchEvent(eventOut);
            });
    };

    const doc = targetIframe.contentDocument;

    console.log("[RENDERING IFRAME] its doc is ", doc);

    doc.open();
    doc.write(iFrameHTML);
    doc.close();
}

function renderInSpan(element, content) {

    const sanitized = DOMPurify.sanitize(content);

    const lines = sanitized.split('\n');

    element.textContent = '';

    lines.forEach((line, index) => {
        element.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            element.appendChild(document.createElement('br'));
        }
    });

    console.log("[RENDERING SPAN] its text is ", sanitized);
}

function renderInImg(element, content) {

    console.log("[RENDERING IMG] its URI is ", content);

    if (content)
        element.src = content;
}

function indexGroupsInNewOrder() {

    const groupElements = document.querySelectorAll('.container .group');

    console.log("[REORDERING GROUPS] ", groupsMap.GROUPS, "According to elements ", groupElements);

    groupElements.forEach((element, index) => {

        const id = element.getAttribute('data-id');

        console.log("[REORDERING GROUPS] new index: ", index, "old index: ", groupsMap.GROUPS.get(id).index, "Group is: ", groupsMap.GROUPS.get(id));

        groupsMap.GROUPS.get(id).index = index;
    });

    document.title = `${groupsMap.GROUPS.values().next().value.name} · Esquisse AI`;

    persistGroups(groupsMap.GROUPS);
}

function getGroupNamesForAutocomplete(currentGroupId) {
    return Array.from(groupsMap.GROUPS.values())
        .filter(group => group.id !== currentGroupId && group.type !== GROUP_TYPE.BREAK)
        .map(group => group.name);
}