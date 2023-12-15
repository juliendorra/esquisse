import { SETTINGS } from './app.js';
import { referencesGraph } from "./reference-graph.js";

export { showDataFlow, removeDataFlow, renderDataFlow };

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

function renderDataFlow() {
    removeDataFlow();
    if (SETTINGS.dataFlowEnabled && !IS_SORTING) {

        showDataFlow(referencesGraph.IS_USED_BY_GRAPH);
    }
}

function showDataFlow(isUsedByGraph = referencesGraph.IS_USED_BY_GRAPH) {

    const isMiniview = document.querySelector(".miniview") ? true : false;

    const endPlugSize = isMiniview ? 0.8 : 1;
    const lineSize = isMiniview ? 2 : 4;

    const nodes = isUsedByGraph.nodes();

    for (const node of nodes) {

        const adjacents = isUsedByGraph.adjacent(node)

        for (const adjacent of adjacents) {

            const sourceElement = document.querySelector(`div[data-id="${node}"]`);
            const targetElement = document.querySelector(`div[data-id="${adjacent}"]`);

            const colors = getComputedStyle(sourceElement).borderColor.split('(')[1].split(')')[0].split(',');

            const color = `rgba(${colors[0]}, ${colors[1]}, ${colors[2]}, 1)`

            const line = new LeaderLine(
                sourceElement,
                targetElement,
                {
                    color: color,
                    dash: { animation: true, len: 6, gap: 16 },
                    endPlug: 'arrow3',
                    path: "arc",
                    size: lineSize,
                    endPlugSize: endPlugSize,
                }
            );

            DATAFLOW_LINES.push(line);
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
        renderDataFlow();
    }
}

const sortStart = (event) => {

    if (event.target === event.currentTarget) {
        IS_SORTING = true;
        removeDataFlow();
    }
}

const sortEnd = (event) => {

    if (event.target === event.currentTarget) {
        IS_SORTING = false;
        renderDataFlow();
    }
}

const graphUpdated = (event) => {

    console.log("[GRAPH UPDATED EVENT HANDLING !!]")
    console.log("IS_SORTING? ", IS_SORTING)

    console.log("SHOW DATA FLOW AFTER GRAPH UPDATE")
    renderDataFlow();
}

zoomableElement.addEventListener("transitionstart", transitionStart);
zoomableElement.addEventListener("transitionend", transitionEnd);

zoomableElement.addEventListener("sortstart", sortStart);
zoomableElement.addEventListener("sortend", sortEnd);

document.addEventListener("graphupdated", graphUpdated);
