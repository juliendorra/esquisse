
import tippy from "https://cdn.jsdelivr.net/npm/tippy.js@6/+esm";
// import 'https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy.min.css';

export { setTooltips, setAccessibleDescriptions };

const TOOLTIPS =
    [
        {
            selector: ".entry-btn",
            text: "Entry: make the data field an ephemeral input. It'll be blank when the app is reloaded, ready for an user to fill it in. The transform is made read-only and saved for later use."
        },

        {
            selector: ".lock-btn",
            text: "Lock: make the data and transform fields read-only. Both are saved for later use"
        },
        {
            selector: ".list-mode-btn",
            text: "List mode: turn a list-like result into a list dropdown, so you can choose one of the answer"
        },
        {
            selector: ".refresh-btn",
            text: "Refresh: reaque to generate a new result"
        },
        {
            selector: ".controlnet-btn",
            text: "Controlnet mode: the structure of image referenced in the data field will be used to constraint the image. When off, the image is used as a starting point (image-to-image)"
        }
    ]

let tooltipInstances = [];


function setAccessibleDescriptions() {

    for (const tooltip of TOOLTIPS) {

        const elements = document.querySelectorAll(tooltip.selector);

        for (const element of elements) {
            element.setAttribute("aria-description", tooltip.text);
        }
    }
}

function setTooltips(tooltipsEnabled) {

    deleteTooltips();

    if (tooltipsEnabled) {
        for (const tooltip of TOOLTIPS) {

            tooltipInstances.push(
                ...tippy(
                    tooltip.selector,
                    { content: tooltip.text, }
                )
            );
        }
    }
}

function deleteTooltips() {

    for (const tooltip of tooltipInstances) {

        tooltip.destroy();

    }
}



