
import { initMeshBackground } from "./mesh-background.js";

import { createZoomedImage } from "./ui-utils.js";


// Call the init function when the page loads

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {

    initMeshBackground();

    addMiniviewButtonsListeners();

    const resultImages = document.querySelectorAll("img.result");

    for (const resultImage of resultImages) {
        resultImage.addEventListener('click', createZoomedImage);
    }
}

// duplicate of miniview handling functions from "./reordering.js" to avoid a cascade of imports

let MINI_VIEW_BY_BUTTON;

function addMiniviewButtonsListeners() {

    const zoomableElement = document.querySelector(".zoomable");

    document
        .querySelector(".enter-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = true;

            const scroll_y = window.scrollY;

            const zoomableElement = document.querySelector(".zoomable");

            const classChangeCallback = (mutationList, observer) => {
                mutationList.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {

                        if (!zoomableElement.classList.contains("miniview")) {

                            setTimeout(() => {
                                console.log("Scrolling back to ", scroll_y);
                                window.scroll({
                                    top: scroll_y
                                });
                            },
                                100
                            )

                            observer.disconnect();
                        }
                    }
                });
            };

            const observerOptions = {
                attributes: true,
                attributeFilter: ['class'],
            };

            const observer = new MutationObserver(classChangeCallback);
            observer.observe(zoomableElement, observerOptions);

            onEnteringMiniview();

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'none';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'inline-block';

        });


    document
        .querySelector(".exit-miniview-btn")
        .addEventListener("click", () => {

            MINI_VIEW_BY_BUTTON = false;

            zoomableElement.classList.remove("miniview");

            const enterMiniviewButton = document.querySelector(".enter-miniview-btn");
            enterMiniviewButton.style.display = 'inline-block';

            const exitMiniviewButton = document.querySelector(".exit-miniview-btn");
            exitMiniviewButton.style.display = 'none';

        });
}


function onEnteringMiniview() {

    applyScale();

    const zoomableElement = document.querySelector(".zoomable");

    zoomableElement.classList.add("miniview");
}

function applyScale() {
    const windowHeight = window.innerHeight;

    const groupsContainer = document.querySelector(".container");
    const containerElementFullHeight = groupsContainer.scrollHeight;

    console.log("[miniview] containerElementFullHeight ", containerElementFullHeight)

    const footerTools = document.querySelector(".footer-tools");
    const footerToolsHeight = footerTools.clientHeight;

    const containerElementVisibleContentHeight = windowHeight - footerToolsHeight;

    console.log("[miniview] containerElementVisibleContentHeight ", containerElementVisibleContentHeight)

    const scale = Math.min(1, containerElementVisibleContentHeight / containerElementFullHeight);

    console.log("[miniview] scale ", scale);

    document.documentElement.style.setProperty('--invert-scale', 1 / scale);

    document.documentElement.style.setProperty('--scale', scale);
}
