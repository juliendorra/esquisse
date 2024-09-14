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

    const visibleSmallerSide = Math.min(visibleWidth, visibleHeight) * window.devicePixelRatio;

    const meshBackgroundCloneUrl = await renderAndReturnUrlOfCopy();

    const meshBackgroundClone = document.createElement('img');
    meshBackgroundClone.src = meshBackgroundCloneUrl;
    meshBackgroundClone.classList.add("mesh-background-clone")
    meshBackgroundClone.id = 'mesh-background-clone';

    const meshBackgroundCanvas = document.querySelector('#mesh-background');

    container.insertBefore(meshBackgroundClone, meshBackgroundCanvas);

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
    function adjustClone(node, clone, after) {
        if (!after) {
            if (node.id === 'mesh-background-clone') {
                clone.style.height = "auto";
                clone.style.width = "auto";
            }

            if (node.classList) {
                if (node.classList.contains('group-name')) {
                    clone.style.fontSize = "2rem";
                }

                if (node.classList.contains('group')) {
                    // clone.style.height = "calc(var(--group-width) + 4.5rem)";
                    clone.style.height = "22rem";
                }

                if (node.classList.contains('group-name')) {
                    clone.style.fontSize = "2rem";
                }
            }
        }

        return clone;
    };

    const renderedHTML = await domtoimage.toCanvas(container, {
        filter: filterNodes, // Apply the filter function
        adjustClonedNode: adjustClone, // Adjust the cloned node where necessary
        bgcolor: "#ffffff99",
        scale: 1,
        style: {
            // width: visibleSmallerSide + "px",
            // height: visibleSmallerSide + "px",

        },
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
