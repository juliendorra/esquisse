import { domToCanvas } from 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.4.39/+esm'

import { renderAndReturnUrlOfCopy } from "./mesh-background.js"

export { captureThumbnail };

async function captureThumbnail() {
    const thumbnailSideLength = 1024;

    const container = document.querySelector(".window-drop-zone");

    const footerTools = document.querySelector(".footer-tools");
    const footerToolsRect = footerTools.getBoundingClientRect();

    const visibleWidth = window.innerWidth;
    const visibleHeight = window.innerHeight - footerToolsRect.height;

    const visibleSmallerSide = Math.min(visibleWidth, visibleHeight) * window.devicePixelRatio;

    const meshBackgroundCloneUrl = await renderAndReturnUrlOfCopy();

    const meshBackgroundClone = document.createElement('img');
    meshBackgroundClone.src = meshBackgroundCloneUrl;
    meshBackgroundClone.classList.add("mesh-background-clone")
    meshBackgroundClone.id = 'mesh-background-clone';

    const meshBackgroundCanvas = document.querySelector('#mesh-background');

    document.querySelector(".zoomable").insertBefore(meshBackgroundClone, meshBackgroundCanvas);

    // Wait for the image of the meshbackgroundclone to load or it won't be included in the render
    try {
        await waitForImageToLoad(meshBackgroundClone);
    } catch (error) {
        console.error("Failed to load the mesh background image");
    }

    // The filter function to exclude nodes
    function filterNodes(node) {
        // Check if the node has a classList before trying to use contains
        if (node.classList) {
            if (
                node.classList.contains('tool-btn') ||
                node.classList.contains('drag-handle') ||
                node.classList.contains('data-text-container') ||
                node.classList.contains('image-import-container') ||
                node.classList.contains('function-buttons-container') ||
                node.classList.contains('result-placeholder')
            ) {
                return false; // Exclude this node
            }
        }

        if (node.id === 'mesh-background') {
            return false;
        }

        return true; // Include everything else
    };

    // The adjustClone callback to handle adjustments on specific cloned nodes
    function adjustClone(clonedDocument) {

        const zoomableElements = clonedDocument.querySelectorAll('.zoomable');
        for (const element of zoomableElements) {
            element.classList.remove("miniview");
            element.style.transform = "none";
            element.style.height = "auto";
            element.style.setProperty('--scale', '1');
            element.style.setProperty('--invert-scale', '1');
        };

        const containerElement = clonedDocument.querySelector('.container');
        containerElement.style.padding = "0";
        // needed to place the groups properly, without space, once they are reduced in height
        // without this property, they stay positioned as if of the previous height
        containerElement.style.alignContent = "flex-start";

        // const groupElements = clonedDocument.querySelectorAll('.group:not(.break)');
        const groupElements = clonedDocument.querySelectorAll('.group');
        for (const element of groupElements) {

            if (element.classList?.contains("break")) {
                element.style.height = "fit-content";
                continue;
            };

            // image result may have the .empty-result class or just be hidden
            const result = element.querySelector(".result");
            const emptyResult = element.querySelector(".result.empty-result");
            const isEmptyImageResult = emptyResult || result?.style.display === "none";

            // modern-screenshot drop the paragraphs in the result iframe directly in the group
            // so no element of class result is left in text gen and static text groups 
            const paragraphResult = element.querySelector("p");
            const isEmptyTextResult = !result && !paragraphResult;

            if (isEmptyImageResult || isEmptyTextResult) {
                element.style.height = "6rem";
            }
            else {
                element.style.height = "calc(var(--group-width) + 6rem)";
            }
        };

        const groupNameElements = clonedDocument.querySelectorAll('.group-name');
        for (const element of groupNameElements) {
            element.style.fontSize = "2rem";
            element.style.height = "fit-content";
        };

        if (window.DEBUG) {
            saveElementAsFile(clonedDocument);
        }
    }

    const renderedHTML = await domToCanvas(container, {
        filter: filterNodes, // Apply the filter function
        onCloneNode: adjustClone, // Adjust the cloned document
        scale: 1,
    });

    const thumbnailCanvas = document.createElement("canvas");
    thumbnailCanvas.width = thumbnailSideLength;
    thumbnailCanvas.height = thumbnailSideLength;

    // Draw and crop the rendered image to the square canvas
    const ctx = thumbnailCanvas.getContext("2d");

    const widthToHeightMultiple = renderedHTML.height / renderedHTML.width;
    const heightToWidthMultiple = renderedHTML.width / renderedHTML.height;

    const portrait = renderedHTML.height > renderedHTML.width;


    ctx.drawImage(renderedHTML, 0, 0,
        portrait ? thumbnailSideLength : thumbnailSideLength * heightToWidthMultiple,
        portrait ? thumbnailSideLength * widthToHeightMultiple : thumbnailSideLength);

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

function waitForImageToLoad(image) {
    return new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });
}


function saveElementAsFile(element, fileName = 'debug.html', fileType = 'text/html') {
    let content = element.outerHTML;

    const blob = new Blob([content], { type: fileType });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    document.body.appendChild(link); // Append link to the body
    link.click(); // Programmatically click the link to trigger the download
    document.body.removeChild(link); // Remove the link after downloading
}

