import { domToCanvas } from 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.4.39/+esm'

import { renderAndReturnUrlOfCopy } from "./mesh-background.js"

export { captureThumbnail };

const CSS_SIZE_CHOICES = new Map([
    [4, 760],
    [6, 1120],
    [12, 1500]
]);

async function captureThumbnail() {
    const thumbnailSideLength = 1024;

    const container = document.querySelector(".window-drop-zone");

    const groupElements = document.querySelectorAll('.group');

    const cssSize = getCssSize(groupElements.length);

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

        return true; // Include everything else
    };

    // The adjustClone callback to handle adjustments on specific cloned nodes
    async function adjustClone(clonedDocument) {

        const zoomableElements = clonedDocument.querySelectorAll('.zoomable');
        for (const zoomableElement of zoomableElements) {
            zoomableElement.classList.remove("miniview");
            zoomableElement.style.transform = "none";
            zoomableElement.style.height = "auto";
            zoomableElement.style.setProperty('--scale', '1');
            zoomableElement.style.setProperty('--invert-scale', '1');
            zoomableElement.style.backgroundColor = "rgb(252,249,244)";

            zoomableElement.style.width = cssSize + "px";
            zoomableElement.style.height = cssSize + "px";
        };

        const waitingElements = clonedDocument.querySelectorAll('.waiting');

        for (const element of waitingElements) {
            console.log("WAITING ELEMENT FOUND");
            element.classList.remove("waiting");
        };

        const containerElement = clonedDocument.querySelector('.container');
        containerElement.style.padding = "0";
        containerElement.style.width = cssSize + "px";
        containerElement.style.height = cssSize + "px";

        // needed to place the groups properly, without space, once they are reduced in height
        // without this property, they stay positioned as if of the previous height
        containerElement.style.alignContent = "flex-start";

        const groupElements = clonedDocument.querySelectorAll('.group');
        for (const groupElement of groupElements) {

            const groupNameElement = groupElement.querySelector('.group-name');

            if (groupElement.classList?.contains("break")) {

                groupNameElement.style.fontSize = "2rem";
                groupNameElement.style.width = "90%";
                groupNameElement.style.height = "fit-content";

                groupElement.style.height = "fit-content";
                continue;
            };

            // image result may have the .empty-result class or just be hidden
            const result = groupElement.querySelector(".result");
            const emptyResult = groupElement.querySelector(".result.empty-result");
            const isEmptyImageResult = emptyResult || result?.style.display === "none";

            // modern-screenshot drop the paragraphs in the result iframe directly in the group
            // so no element of class result is left in text gen and static text groups 
            const paragraphResult = groupElement.querySelector("p");
            const isEmptyTextResult = !result && !paragraphResult;

            // if (isEmptyImageResult || isEmptyTextResult) {
            //     groupElement.style.width = "calc(var(--group-width) / 2)";
            //     groupElement.style.height = "6rem";

            //     groupNameElement.style.fontSize = "2rem";
            //     groupNameElement.style.height = "fit-content";
            //     groupNameElement.style.width = "100%";

            // }
            // else {
            groupElement.style.height = "calc(var(--group-width) + 6rem)";
            groupElement.style.overflow = "hidden";

            groupNameElement.style.fontSize = "2rem";
            groupNameElement.style.height = "fit-content";
            groupNameElement.style.width = "auto";

            // }
        };
        const meshBackground = clonedDocument.querySelector('.zoomable > img:first-of-type:not(result)');

        meshBackground.style.width = cssSize + "px";
        meshBackground.style.height = cssSize + "px";

        const { dataURI } = await renderOffscreenMeshbackground({ container: clonedDocument, cssSize });

        if (window.DEBUG) {
            // Save the background only
            const a = document.createElement('a');
            a.href = dataURI;
            a.download = `meshBackgroundClone.jpeg`;
            a.click();
        }

        meshBackground.src = dataURI;
        meshBackground.style.filter = "blur(0.2rem) brightness(1.02)";
        // meshBackground.decoding = "async";
        // meshBackground.loading = "lazy";

        if (window.DEBUG) {
            saveElementAsFile(clonedDocument, "clonedNode.html");
        }
    }

    const styleObject = {
        transform: "scale(1)",
        width: cssSize + "px",
        height: cssSize + "px",
        backgroundColor: "rgb(252,249,244)",
    };

    const stylePropertiesToInclude = [
        'align-items',
        'align-self',
        'background-color',
        'border-color',
        'border-color',
        'border-radius',
        'border-style',
        'border',
        'bottom',
        'box-shadow',
        'box-sizing',
        'display',
        'filter',
        'flex-wrap',
        'flex-basis',
        'flex-wrap',
        'flex-direction',
        'font-family',
        'font-size',
        'height',
        'justify-content',
        'left',
        'margin-bottom',
        'margin-left',
        'margin-right',
        'margin-top',
        'margin',
        'max-height',
        'overflow-clip-margin',
        'overflow-x',
        'overflow-y',
        'overflow',
        'padding-bottom',
        'padding-left',
        'padding-right',
        'padding-top',
        'padding',
        'position',
        'resize',
        'right',
        'text-align',
        'text-indent',
        'top',
        'vertical-align',
        'visibility',
        'white-space',
        'width',
        'z-index',

        // 'transition',
        'transform',
        // 'transform-origin',

    ];

    const renderedHTML = await domToCanvas(container, {
        width: cssSize,
        height: cssSize,
        filter: filterNodes, // Apply the filter function
        onCloneNode: adjustClone, // Adjust the cloned document,
        style: styleObject,
        includeStyleProperties: stylePropertiesToInclude,
        scale: 2,
    });

    if (window.DEBUG) {
        // Save the full capture 
        const blob = await canvasToBlob(renderedHTML);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `full-capture.jpeg`;
        a.click();
        URL.revokeObjectURL(url);
    }

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

    return blob;
};

async function renderOffscreenMeshbackground({ container, cssSize }) {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = container.offsetWidth;
    iframe.style.height = container.offsetHeight;
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Clone the container into the iframe
    const clonedContainer = container.cloneNode(true);

    iframeDoc.body.appendChild(clonedContainer);

    const meshBackground = clonedContainer.querySelector('.zoomable > img:first-of-type:not(result)');

    meshBackground.style.width = cssSize + "px";
    meshBackground.style.height = cssSize + "px";

    if (window.DEBUG) {
        console.log("[SCREEN CAPTURE] saving the iframe doc used to compute mesh background")
        iframeDoc.body.style.display = "block";
        saveElementAsFile(iframeDoc.body, 'iframe-passed-for-mesh.html');
    }

    // Request the rendered image URI from the offscreen renderer
    const { dataURI } = await renderAndReturnUrlOfCopy(iframeDoc);

    // Clean up: remove the iframe
    document.body.removeChild(iframe);

    return { dataURI };
}

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

function getCssSize(numberOfGroups) {

    // Convert the map to an array and sort the keys in ascending order to avoid insertion order issues
    const sortedEntries = [...CSS_SIZE_CHOICES.entries()].sort((a, b) => a[0] - b[0]);

    let size = sortedEntries[0][1]; // Default to smallest value

    for (const [groupThreshold, captureSize] of sortedEntries) {
        if (numberOfGroups > groupThreshold) {
            size = captureSize;
        }
    }
    console.log("[SCREEN CAPTURE] Size of the capture window ", size)
    return size;
};

