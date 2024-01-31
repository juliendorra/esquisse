
import tippy, { roundArrow } from "https://cdn.jsdelivr.net/npm/tippy.js@6/+esm";
// import 'https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy.min.css';

export { setTooltips, setAccessibleDescriptions };

const TOOLTIPS =
    [
        {
            selector: ".entry-btn",
            text: "Entry: makes the data field an ephemeral input. It'll be blank when the app is reloaded, ready for an user to fill it in. The transform is made read-only and saved for later use."
        },

        {
            selector: ".lock-btn",
            text: "Lock: makes the data and transform fields read-only. Both are saved for later use"
        },
        {
            selector: ".list-mode-btn",
            text: "List mode: turns a list-like text result into a list dropdown, so you can choose one of the answer"
        },
        {
            selector: ".refresh-btn",
            text: "Refresh: requests to generate a new result"
        },
        {
            selector: ".controlnet-btn",
            text: "Controlnet mode: the structure of the image referenced in the data field will be used to constrain the image. When off, the image is used as a starting point (image-to-image). Note that only the first image referenced is used in both case."
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
                    {
                        content: tooltip.text,
                        theme: 'esquisse',
                    }
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



