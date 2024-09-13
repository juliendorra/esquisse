import domtoimage from "https://cdn.jsdelivr.net/npm/dom-to-image-more@3.4.3/+esm";
import { renderAndReturnUrlOfCopy } from "./mesh-background.js"

export { captureThumbnail };

async function captureThumbnail() {
    const thumbnailSideLength = 1024;

    const container = document.querySelector(".zoomable");

    const footerTools = document.querySelector(".footer-tools");
    const footerToolsRect = footerTools.getBoundingClientRect();

    const visibleWidth = window.innerWidth;
    const visibleHeight = window.innerHeight - footerToolsRect.height;

    const visibleSmallerSide = Math.min(visibleWidth, visibleHeight);

    const meshBackgroundCloneUrl = await renderAndReturnUrlOfCopy();

    const meshBackgroundClone = document.createElement('img');
    meshBackgroundClone.src = meshBackgroundCloneUrl;
    meshBackgroundClone.classList.add("mesh-background-clone")
    meshBackgroundClone.id = 'mesh-background-clone';

    const meshBackgroundCanvas = document.querySelector('#mesh-background');

    container.insertBefore(meshBackgroundClone, meshBackgroundCanvas);

    // A function for the adjustClonedNode callback
    // It gets the original node, the cloned node, and a boolean that says if we've cloned the children already (so you can handle either before or after)
    const adjustClone = (node, clone, after) => {
        if (!after && node.id === 'mesh-background') {
            clone.id = "mesh-background";
        }
        return clone;
    }

    // We set up a function for the onClone callback
    // The function alter in place the clone pepared for rendering 
    // The clone has the meshbackground canvas already replaced with img tags, loosing its id
    // so we need to also use the adjustClonedNode callback to catch it
    const alterDom = (cloneElement) => {

        // console.log("[CAPTURE THUMBNAIL] full document", cloneElement)

        // const containerClone = cloneDocument.querySelector(".zoomable");
        // console.log("[CAPTURE THUMBNAIL] container clone ", containerClone)

        // const meshBackgroundCanvas = cloneElement.querySelector('#mesh-background');
        // console.log("[CAPTURE THUMBNAIL] mesh background found ", meshBackgroundCanvas)

        // containerClone.insertBefore(meshBackgroundClone, meshBackgroundCanvas);

        const meshBackgroundClone = cloneElement.querySelector('#mesh-background-clone');
        meshBackgroundClone.style.height = "auto";
        meshBackgroundClone.style.width = "auto";

        const meshBackgroundCanvas = cloneElement.querySelector('#mesh-background');
        meshBackgroundCanvas.style.display = "none";
        meshBackgroundCanvas.remove();

        // customize groups appearance, closer to result page
        const buttons = cloneElement.querySelectorAll('.tool-btn');
        const dragHandles = cloneElement.querySelectorAll('.drag-handle');
        const groupIcons = cloneElement.querySelectorAll('.group-header img');
        const dataTextContainers = cloneElement.querySelectorAll('.data-text-container');
        const dropZones = cloneElement.querySelectorAll('.drop-zone');

        for (const button of [...buttons, ...dragHandles, ...groupIcons, ...dataTextContainers, ...dropZones]) {
            button.style.display = "none";
        }

        console.log("[CAPTURE THUMBNAIL] altered elememt", cloneElement)

    }

    const renderedHTML = await domtoimage.toCanvas(container, {
        adjustClonedNode: adjustClone,
        onclone: alterDom,
        bgcolor: "#ffffff99",
        scale: window.devicePixelRatio,
        width: visibleSmallerSide,
        height: visibleSmallerSide,
    });

    const thumbnailCanvas = document.createElement("canvas");
    thumbnailCanvas.width = thumbnailSideLength;
    thumbnailCanvas.height = thumbnailSideLength;

    // Draw and crop the rendered image to the square canvas
    const ctx = thumbnailCanvas.getContext("2d");

    ctx.drawImage(renderedHTML, 0, 0, thumbnailSideLength, thumbnailSideLength);

    const blob = await canvasToBlob(thumbnailCanvas);

    if (window.DEBUG) {
        // Save the final thumbnail
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esquisse-result-thumbnail.jpeg`;
        a.click();
        URL.revokeObjectURL(url);
    }

    meshBackgroundClone.remove();

    return blob;
};


// utils 
function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
        canvas.toBlob(
            resolve,
            'image/jpeg',
            0.9
        );
    });
};