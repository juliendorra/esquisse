import { SETTINGS } from './app.js';
import { referencesGraph } from "./referencegraphmanagement.js";

export { showDataFlow, removeDataFlow };

let IS_SORTING = false;

let DATAFLOW_LINES = [];

// Palette generated thanks to 
// https://gka.github.io/palettes/
// https://www.zonums.com/online/color_converter/

const DATAFLOW_LINES_PALETTE =
    [
        "rgba(233,0,44,0.5)",
        "rgba(255,111,159,0.5)",
        "rgba(255,185,220,0.5)",
        "rgba(255,255,227,0.5)",
        "rgba(221,214,253,0.5)",
        "rgba(195,172,242,0.5)",
        "rgba(241,104,133,0.5)"
    ];


function showDataFlow(isUsedByGraph) {

    const nodes = isUsedByGraph.nodes();

    for (const node of nodes) {

        const adjacents = isUsedByGraph.adjacent(node)

        for (const adjacent of adjacents) {

            const sourceElement = document.querySelector(`div[data-id="${node}"]`);
            const targetElement = document.querySelector(`div[data-id="${adjacent}"]`);

            // Pick colors in cycle
            const colorIndex = DATAFLOW_LINES.length % DATAFLOW_LINES_PALETTE.length;
            const color = DATAFLOW_LINES_PALETTE[colorIndex];

            DATAFLOW_LINES.push(
                new LeaderLine(
                    sourceElement,
                    targetElement,
                    {
                        color: color,
                        dash: { animation: true },
                        endPlug: 'arrow3',
                    }
                )
            );
        }
    }
}

function removeDataFlow() {
    for (const line of DATAFLOW_LINES) {
        line.remove();
    }
    DATAFLOW_LINES = [];
}

// Miniview event handling

const zoomableElement = document.querySelector(".zoomable");


const transitionStart = (event) => {

    if (event.target === event.currentTarget) {
        removeDataFlow();
    }
}

const transitionEnd = (event) => {

    if (event.target === event.currentTarget) {

        removeDataFlow();
        if (SETTINGS.dataFlowEnabled && !IS_SORTING) {

            showDataFlow(referencesGraph.IS_USED_BY_GRAPH);
        }
    }
}

const sortStart = (event) => {

    if (event.target === event.currentTarget) {
        removeDataFlow();
        IS_SORTING = true;
    }
}

const sortEnd = (event) => {

    if (event.target === event.currentTarget) {

        removeDataFlow();
        if (SETTINGS.dataFlowEnabled) {
            showDataFlow(referencesGraph.IS_USED_BY_GRAPH);
        }
        IS_SORTING = false;
    }
}

zoomableElement.addEventListener("transitionstart", transitionStart)
zoomableElement.addEventListener("transitionend", transitionEnd)

zoomableElement.addEventListener("sortstart", sortStart)
zoomableElement.addEventListener("sortend", sortEnd)
