
import { renderDataFlow } from "./flow-visualization.js";

import { addMiniviewButtonsListeners } from "./reordering.js";

import { GROUP_TYPE, getGroupIdFromElement } from "./group-utils.js";

import { loadGroups, downloadEsquisseJson, handleEsquisseJsonUpload } from "./persistence.js";

import { groupsMap, createGroupAndAddGroupElement } from "./group-management.js";

import { handleDroppedImage, handleInputChange } from "./input-change.js";

import { initGroupObservation } from "./group-elements-observer.js";

import { initMeshBackground } from "./mesh-background.js";
import { displayAlert } from "./ui-utils.js";

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

            const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE);

            handleDroppedImage(file, groupElement, groupsMap.GROUPS);

        }

        for (const file of textFiles) {

            const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.STATIC);

            handleDroppedText(file, groupElement, groupsMap.GROUPS);
        }
    });


    addMiniviewButtonsListeners();

    document
        .querySelector(".add-break-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.BREAK));

    document
        .querySelector(".add-static-group-btn")
        .addEventListener("click", () => createGroupAndAddGroupElement(GROUP_TYPE.STATIC));

    document.querySelector(".add-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.TEXT)
    );

    document.querySelector(".add-img-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMAGE)
    );

    document.querySelector(".add-imported-image-group-btn").addEventListener("click", () =>
        createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE)
    );

    // Settings Menu Listeners

    const settingsMenu = document.querySelector('.settings-menu');

    const openButton = document.querySelector('.open-settings-menu-btn');
    const closeButtons = settingsMenu.querySelectorAll('.close-settings-menu-btn');

    openButton.addEventListener('click', () => settingsMenu.show());

    for (const closeButton of closeButtons) {
        closeButton.addEventListener('click', () => settingsMenu.hide());
    }

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

    document.getElementById('share-btn').addEventListener('click', function () {
        // Check if the Web Share API is supported
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            }).then(() => {
                console.log('[SETTINGS MENU] URL shared');
            })
                .catch(console.error);
        } else {
            // Fallback to Clipboard API
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    displayAlert(
                        {
                            issue: "Link to this app copied!",
                            action: "Paste the link to share your app.",
                            variant: "success",
                            icon: "person-arms-up",
                            duration: 3000
                        }
                    )
                })
                .catch(console.error);
        }
    });

    document.getElementById('download-json-btn').addEventListener('click', () => {
        downloadEsquisseJson(groupsMap.GROUPS);
    });

    const uploadJsonZone = document.getElementById('upload-json-zone');

    uploadJsonZone.addEventListener(
        'drop',
        (event) => {
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

    uploadJsonZone.addEventListener(
        'click',
        (event) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'application/json';

            fileInput.onchange = e => {
                const file = e.currentTarget.files[0];
                handleEsquisseJsonUpload(file);
            };
            fileInput.click();
        }
    );

    initMeshBackground();
    initGroupObservation();
}
