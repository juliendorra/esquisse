import { domToCanvas } from 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.4.39/+esm'

import { renderAndReturnUrlOfCopy } from "./mesh-background.js"

export { captureThumbnail };

async function captureThumbnail() {
    const thumbnailSideLength = 1024;

    const container = document.querySelector(".window-drop-zone");

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

        const groupElements = clonedDocument.querySelectorAll('.group');

        for (const element of groupElements) {

            const groupNameElement = element.querySelector('.group-name');

            if (element.classList?.contains("break")) {

                groupNameElement.style.fontSize = "2rem";
                groupNameElement.style.height = "fit-content";

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
                element.style.width = "calc(var(--group-width) / 2)";
                element.style.height = "6rem";

                groupNameElement.style.fontSize = "2rem";
                groupNameElement.style.height = "fit-content";
                groupNameElement.style.width = "100%";

            }
            else {
                element.style.height = "calc(var(--group-width) + 6rem)";

                groupNameElement.style.fontSize = "2rem";
                groupNameElement.style.height = "fit-content";
                groupNameElement.style.width = "auto";

            }
        };

        const { dataURI } = await renderOffscreenMeshbackground(clonedDocument);

        if (window.DEBUG) {
            // Save the final thumbnail
            const a = document.createElement('a');
            a.href = dataURI;
            a.download = `meshBackgroundClone.png`;
            a.click();
        }

        // const meshBackgroundClone = document.createElement('img');
        const meshBackgroundCanvas = clonedDocument.querySelector('.zoomable img:first-of-type');

        // clonedDocument.querySelector(".zoomable").insertBefore(meshBackgroundClone, meshBackgroundCanvas);

        meshBackgroundCanvas.src = dataURI;

        if (window.DEBUG) {
            clonedDocument.querySelector("body").style.display = "block";
            saveElementAsFile(clonedDocument);
        }
    }

    const renderedHTML = await domToCanvas(container, {
        filter: filterNodes, // Apply the filter function
        onCloneNode: adjustClone, // Adjust the cloned document,
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

    return blob;
};

async function renderOffscreenMeshbackground(container) {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Clone the container into the iframe
    const clonedContainer = container.cloneNode(true);

    iframeDoc.body.appendChild(clonedContainer);

    // Request the rendered image URI from the offscreen renderer
    const { blobURL, blob, dataURI } = await renderAndReturnUrlOfCopy(iframeDoc);

    // Clean up: remove the iframe
    document.body.removeChild(iframe);

    return { blobURL, blob, dataURI };
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

function waitForImageToLoad(image) {
    return new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });
}

function getComputedStylesOfElements(element, selector) {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';  // Optional: Set width and height to 0 to further minimize impact
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    const clonedElement = element.cloneNode(true);
    iframeDoc.body.appendChild(clonedElement);

    const elements = iframeDoc.querySelectorAll(selector);

    console.log("GETTING COMPUTED STYLES FOR ", elements);

    const computedStyles = [];

    // Useful to determine the number and position of flex rows 
    const offsetTopForAllRows = new Set();
    // Useful to determine if a group is in the the last flex row 
    let largestOffsetTop = 0;

    // Use the iframe's window object to get computed styles
    for (const element of elements) {

        computedStyles.push({
            borderColor: iframe.contentWindow.getComputedStyle(element, null).borderColor,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight,
            offsetTop: element.offsetTop,
            offsetLeft: element.offsetLeft
        });

        offsetTopForAllRows.add(element.offsetTop);

        if (element.offsetTop > largestOffsetTop) {
            largestOffsetTop = element.offsetTop;
        }
    }

    document.body.removeChild(iframe);

    return { computedStyles, largestOffsetTop, offsetTopForAllRows };
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

