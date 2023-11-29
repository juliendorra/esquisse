
import { renderDataFlow } from "./flow-visualization.js";

import { addMiniviewButtonsListeners } from "./reordering.js";

import { GROUP_TYPE, getGroupIdFromElement } from "./group-utils.js";

import { loadGroups, downloadEsquisseJson, handleEsquisseJsonUpload } from "./persistence.js";

import { groupsMap, createGroupAndAddGroupElement } from "./group-management.js";

import { handleDroppedImage, handleInputChange } from "./input-change.js";

import { referencesGraph } from "./reference-graph.js";

import { initGroupObservation } from "./group-elements-observer.js";

import { initMeshBackground } from "./mesh-background.js";

const SETTINGS = {

    qualityEnabled: false,
    dataFlowEnabled: false,

}

export { SETTINGS };

// Call the init function when the page loads

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {

    const loadingResult = await loadGroups();

    console.log(loadingResult);

    const { groups, isUsedByGraph } = loadingResult;

    groupsMap.GROUPS = groups;
    referencesGraph.IS_USED_BY_GRAPH = isUsedByGraph;


    // Dropping an image on the page will create an imported image block and group with the image

    document.querySelector('.window-drop-zone')
        .addEventListener(
            "dragover",
            (event) => {
                event.preventDefault();
                event.currentTarget.classList.add('drop-zone-over');
            });


    document.querySelector('.window-drop-zone')
        .addEventListener(
            "dragleave",
            event => {
                event.preventDefault();
                event.currentTarget.classList.remove('drop-zone-over');
            });

    document.querySelector('.window-drop-zone').addEventListener("drop", (event) => {

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drop-zone-over');

        const files = Array.from(event.dataTransfer.files);

        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        console.log("TEST IMAGE FILES: ", imageFiles)

        const textFiles = files.filter(file => file.type.startsWith('text/'));

        let index = 0

        for (const file of imageFiles) {

            console.log("TEST ADDING IMAGE ", index++)

            const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE, groupsMap.GROUPS);

            handleDroppedImage(file, groupElement, groupsMap.GROUPS);

        }

        for (const file of textFiles) {

            const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.STATIC, groupsMap.GROUPS);

            handleDroppedText(file, groupElement, groupsMap.GROUPS);
        }
    });


    addMiniviewButtonsListeners();

    document
        .querySelector(".add-break-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.BREAK, groupsMap.GROUPS));

    document
        .querySelector(".add-static-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.STATIC, groupsMap.GROUPS));

    document.querySelector(".add-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT, groupsMap.GROUPS)
    );

    document.querySelector(".add-img-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMAGE, groupsMap.GROUPS)
    );

    document.querySelector(".add-imported-image-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE, groupsMap.GROUPS)
    );

    // Settings Menu Listeners

    const settingsMenu = document.querySelector('.settings-menu');

    const openButton = document.querySelector('.open-settings-menu-btn');
    const closeButton = settingsMenu.querySelector('.close-settings-menu-btn');

    openButton.addEventListener('click', () => settingsMenu.show());
    closeButton.addEventListener('click', () => settingsMenu.hide());

    const qualitySwitch = settingsMenu.querySelector('.quality-switch');

    qualitySwitch.addEventListener('sl-change', event => {
        console.log(event.target.checked ? 'qualitySwitch checked' : 'qualitySwitch un-checked');
        SETTINGS.qualityEnabled = event.target.checked;
    });

    const dataflowSwitch = settingsMenu.querySelector('.dataflow-switch');

    dataflowSwitch.addEventListener('sl-change', event => {
        console.log(event.target.checked ? 'dataflow-switch checked' : 'dataflow-switch un-checked');

        if (event.target.checked) {
            SETTINGS.dataFlowEnabled = true;
            renderDataFlow();
        }
        else {
            SETTINGS.dataFlowEnabled = false;
            renderDataFlow();
        }

    });

    document.getElementById('download-json-btn').addEventListener('click', () => {
        downloadEsquisseJson(groupsMap.GROUPS);
    });

    const uploadJsonZone = document.getElementById('upload-json-zone');

    uploadJsonZone.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drop-zone-over');

        const files = Array.from(event.dataTransfer.files);
        const jsonFiles = files.filter(file => file.type === 'application/json');
        console.log("JSON FILES: ", jsonFiles)

        handleEsquisseJsonUpload(jsonFiles[0]);
    });

    uploadJsonZone.addEventListener(
        "dragover",
        (event) => {
            event.preventDefault();
            event.currentTarget.classList.add('drop-zone-over');
        });


    uploadJsonZone.addEventListener(
        "dragleave",
        event => {
            event.preventDefault();
            event.currentTarget.classList.remove('drop-zone-over');
        });



    initMeshBackground();
    initGroupObservation();
}
