import { renderDataFlow } from "./flow-visualization.js";

import { addMiniviewButtonsListeners } from "./reordering.js";

import { GROUP_TYPE, getGroupIdFromElement } from "./group-utils.js";

import { loadGroups, shareResult, downloadEsquisseJson, handleEsquisseJsonUpload, beaconGroups, persistGroupsOnHide, persistGroups } from "./persistence.js";

import { groupsMap, createGroupAndAddGroupElement } from "./group-management.js";

import { handleDroppedImage, handleInputChange } from "./input-change.js";

import { initGroupObservation } from "./group-elements-observer.js";

import { initMeshBackground } from "./mesh-background.js";

import { displayAlert, resizeAllTextAreas, setShortcuts } from "./ui-utils.js";
import { setAccessibleDescriptions, setTooltips } from "./tooltips.js";

const SETTINGS = {

    qualityEnabled: false,
    dataFlowEnabled: false,
    tooltipsEnabled: false,

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

    // As we throttle groups persisting (not saving each change), we persist the groups when the user switch away or close the tab,

    document.addEventListener('visibilitychange', function (event) {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        persistGroupsOnHide(groupsMap.GROUPS)
    });

    window.addEventListener('beforeunload', function (event) {
        // fires when user close tab. The browser won't launch a standard fetch on close,
        // so we use sendBeacon to send the groups blindly
        beaconGroups(groupsMap.GROUPS);
    });

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

    document.querySelector('.window-drop-zone').addEventListener(
        "drop",
        (event) => {

            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.classList.remove('drop-zone-over');

            const files = Array.from(event.dataTransfer.files);

            const imageFiles = files.filter(file => file.type.startsWith('image/'));

            const textFiles = files.filter(file => file.type.startsWith('text/'));

            for (const file of imageFiles) {

                const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE);

                const group = groupsMap.GROUPS.get(getGroupIdFromElement(groupElement));

                handleDroppedImage(file, groupElement);

            }

            for (const file of textFiles) {

                const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.STATIC);

                handleDroppedText(file, groupElement, groupsMap.GROUPS);
            }

            const textData = JSON.parse(event.dataTransfer.getData('application/json'));

            console.log("[TEXT DATA FROM DRAG] :", textData)

            // expecting { add: [{ groupType: groupType }, ... ] } from dragging an add group button

            if (textData && textData.add && textData.add.length > 0) {
                const groupTypes = Object.values(GROUP_TYPE);
                for (const group of textData.add) {
                    if (groupTypes.includes(group.groupType)) {
                        createGroupAndAddGroupElement(group.groupType);
                    }
                }
            }
        }
    );

    addMiniviewButtonsListeners();

    document.querySelector(".clone-app-btn").addEventListener('click', (event) => {
        persistGroups(groupsMap.GROUPS);
    });

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

    document.querySelector(".share-result-btn").addEventListener('click', (event) => {
        shareResult(groupsMap.GROUPS, event.currentTarget);
    });

    function addDragAndDropListeners(buttonSelector, groupType) {
        const button = document.querySelector(buttonSelector);

        button.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('application/json', JSON.stringify({ add: [{ groupType: groupType }] }));
        });
    }

    addDragAndDropListeners('.add-static-group-btn', GROUP_TYPE.STATIC);
    addDragAndDropListeners('.add-break-group-btn', GROUP_TYPE.BREAK);
    addDragAndDropListeners('.add-imported-image-group-btn', GROUP_TYPE.IMPORTED_IMAGE);
    addDragAndDropListeners('.add-group-btn', GROUP_TYPE.TEXT);
    addDragAndDropListeners('.add-img-group-btn', GROUP_TYPE.IMAGE);


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
        SETTINGS.qualityEnabled = event.target.checked;
    });

    const dataflowSwitch = settingsMenu.querySelector('.dataflow-switch');

    dataflowSwitch.addEventListener('sl-change', event => {
        SETTINGS.dataFlowEnabled = event.target.checked;
        renderDataFlow();
    });

    const listviewSwitch = settingsMenu.querySelector('.list-view-switch');

    listviewSwitch.addEventListener('sl-change', event => {
        SETTINGS.listViewEnabled = event.target.checked;
        const container = document.querySelector('.container');
        if (SETTINGS.listViewEnabled) {
            container.classList.add("list-view");
        }
        else {
            container.classList.remove("list-view");
        }

        resizeAllTextAreas(container, SETTINGS.listViewEnabled);
    });

    const tooltipsSwitch = settingsMenu.querySelector('.tooltips-switch');

    tooltipsSwitch.addEventListener('sl-change', event => {
        SETTINGS.tooltipsEnabled = event.target.checked;
        setTooltips(SETTINGS.tooltipsEnabled);
    });

    document.addEventListener('group-element-added-or-removed', event => {

        setAccessibleDescriptions();

        setTooltips(SETTINGS.tooltipsEnabled);

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

    setAccessibleDescriptions();
    setShortcuts();

    window.addEventListener('resize', () => {

        const containerListView = document.querySelector('.container.list-view');

        if (containerListView) {
            resizeAllTextAreas(containerListView, true);
        }
    });
}