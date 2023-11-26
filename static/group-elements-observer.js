import { renderBackground } from "./mesh-background.js";
import { renderDataFlow } from "./flow-visualization.js";
import { applyScale } from "./reordering.js";

export { initGroupObservation };

// Observe for added, removed, moved and resized groups and rerender

const containerElement = document.querySelector('.container');

let previousOrder = Array
    .from(document.querySelectorAll('.container .group'))
    .map(child => child.getAttribute('data-id'));


function onGroupChanged(mutationsList) {
    for (let mutation of mutationsList) {
        if (mutation.type === 'childList') {

            // Observe added nodes
            for (let addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.classList.contains('group')) {

                    groupResizeObserver.observe(addedNode);
                }
            }

            // Unobserve removed nodes and handle their removal
            for (let removedNode of mutation.removedNodes) {
                if (removedNode.nodeType === Node.ELEMENT_NODE && removedNode.classList.contains('group')) {

                    groupResizeObserver.unobserve(removedNode);
                }
            }

            let currentOrder = Array
                .from(document.querySelectorAll('.container .group'))
                .map(child => child.getAttribute('data-id'));

            if (!arraysEqual(previousOrder, currentOrder)) {
                applyScale();
                renderBackground();
                renderDataFlow();
                previousOrder = currentOrder;
            }
        }
    }
};

function onGroupResized(entries) {
    for (let entry of entries) {
        if (entry.target.classList.contains('group')) {
            applyScale()

            renderBackground();

            renderDataFlow();
        }
    }
}

const groupChangeObserver = new MutationObserver(onGroupChanged);

const groupResizeObserver = new ResizeObserver(onGroupResized);

function initGroupObservation() {
    groupChangeObserver.observe(containerElement, {
        childList: true,
        subtree: false,
    });

    const groupElements = containerElement.querySelectorAll('.group');

    groupElements.forEach(group => {
        groupResizeObserver.observe(group);
    });
}

// util

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }

    return true;
}