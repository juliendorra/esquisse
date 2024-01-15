import html2canvas from "./html2canvas.esm.js";
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

    // We set up a function for the clone callback
    // The function alter in place the document clone used for rendering 
    const alterDom = (document, element) => {

        // Replacing the 3D canvas background with the static image
        // this is the cloned container, not the original container
        const container = document.querySelector(".zoomable");
        const meshBackgroundCanvas = document.querySelector('#mesh-background');
        container.insertBefore(meshBackgroundClone, meshBackgroundCanvas);
        meshBackgroundCanvas.remove();

        // customize groups appearance, closer to result page
        const buttons = document.querySelectorAll('.tool-btn');
        const dragHandles = document.querySelectorAll('.drag-handle');
        const groupIcons = document.querySelectorAll('.group-header img');
        const dataTexts = document.querySelectorAll('.data-text');
        const referencedResultTexts = document.querySelectorAll('.referenced-result-text');
        const transformTexts = document.querySelectorAll('.transform-text');
        const dropZones = document.querySelectorAll('.drop-zone');

        for (const button of [...buttons, ...dragHandles, ...groupIcons, ...dataTexts, ...referencedResultTexts, ...transformTexts, ...dropZones]) {
            button.style.display = "none";
        }
    }

    const renderedHTML = await html2canvas(container, {
        logging: false,
        onclone: alterDom,
        x: 0,
        y: 0,
        windowWidth: visibleWidth,
        windowHeight: visibleHeight,
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