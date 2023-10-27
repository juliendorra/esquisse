
import { showDataFlow, removeDataFlow } from "./flow-visualization.js";

import { addMiniviewButtonsListeners } from "./reordering.js";

import { GROUP_TYPE } from "./group-utils.js";

import { urlOrigin, persistGroups, loadGroups } from "./persistence.js";

import { groupsMap, createGroupAndAddGroupElement } from "./group-management.js";

import { referencesGraph } from "./reference-graph.js";

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

function init() {

    const loadingResult = loadGroups();

    console.log(loadingResult);

    const { groups, isUsedByGraph } = loadingResult;

    groupsMap.GROUPS = groups;
    referencesGraph.IS_USED_BY_GRAPH = isUsedByGraph;

    window.addEventListener("hashchange", () => {
        console.log("Hash changed! Programmatically? ", urlOrigin.HAS_HASH_CHANGED_PROGRAMMATICALLY);
        if (!urlOrigin.HAS_HASH_CHANGED_PROGRAMMATICALLY) {

            const { groups, isUsedByGraph } = loadGroups();

            groupsMap.GROUPS = groups;
            referencesGraph.IS_USED_BY_GRAPH = isUsedByGraph;

        }
        urlOrigin.HAS_HASH_CHANGED_PROGRAMMATICALLY = false;
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
            showDataFlow(referencesGraph.IS_USED_BY_GRAPH);
        }
        else {
            SETTINGS.dataFlowEnabled = false;
            removeDataFlow();
        }

    });

    initMeshBackground();
}
