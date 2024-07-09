import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkeys-js@3/+esm';

export { displayAlert, hideAddBlocksButtons, showAddBlocksButtons, removeGlobalWaitingIndicator, createZoomedImage, createZoomedIframe, setShortcuts, resizeTextArea, resizeAllTextAreas };

// this function needs shoelace custom elements to be defined to works
async function displayAlert({ issue, action, variant = "warning", icon = "exclamation-triangle", duration = 3000 }) {

    const alert = document.createElement("sl-alert");

    alert.variant = variant;
    alert.duration = duration;
    alert.closable = true;

    let alertHtml = `
            <sl-icon slot="icon" name="${icon}"></sl-icon>
            <strong>${issue}</strong><br />
            ${action}
    `;

    alert.innerHTML = alertHtml;

    document.body.appendChild(alert);

    await customElements.whenDefined('sl-alert');
    alert.toast();

    return alert;
}

function hideAddBlocksButtons() {
    document.querySelector(".add-block-tools").style.display = "none";
    document.querySelector(".edit-app-tools").style.display = "inline";
}

function showAddBlocksButtons() {
    document.querySelector(".add-block-tools").style.display = "inline";
    document.querySelector(".edit-app-tools").style.display = "none";
}

function removeGlobalWaitingIndicator() {

    // is there any group or other active element waiting?
    const waitingElement = document.querySelector(".waiting:not(.fetching-indicator)");

    if (!waitingElement) {
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");

        fetchingIndicatorElement.classList.remove("waiting");
    }
}

function createZoomedImage(event) {

    let clonedImage = event.currentTarget.cloneNode(true);

    clonedImage.classList.add('zoomed');

    document.body.classList.add('no-scroll');

    clonedImage.addEventListener('click',
        function (event) {
            document.body.classList.remove('no-scroll');
            clonedImage.remove();
            clonedImage = null;
        });

    document.body.appendChild(clonedImage);

}

function createZoomedIframe(originalIframe) {
    let newIframe = document.createElement('iframe');
    newIframe.classList.add('zoomed');
    newIframe.sandbox = originalIframe.sandbox;

    document.body.classList.add('no-scroll');

    let zoomedContainer = document.createElement('div');
    zoomedContainer.className = 'zoomed-container';
    zoomedContainer.appendChild(newIframe);

    let closeButton = document.createElement('button');
    closeButton.className = 'close-zoomed';
    closeButton.innerHTML = 'Close';
    closeButton.onclick = () => {
        document.body.classList.remove('no-scroll');
        zoomedContainer.remove();
    };

    zoomedContainer.appendChild(closeButton);

    document.body.appendChild(zoomedContainer);

    // Get the contentDocument of the original iframe and inject it into the new iframe
    const originalDoc = originalIframe.contentDocument;
    const newDoc = newIframe.contentDocument;

    newDoc.open();
    newDoc.write(originalDoc.documentElement.outerHTML);
    newDoc.close();
}

function setShortcuts() {

    hotkeys(
        'ctrl+d+e',
        (event) => {
            console.log("Click circles activated")
            document.removeEventListener("click", showClickCircle)
            document.addEventListener("click", showClickCircle)
        })
}

function showClickCircle(event) {
    const clickCircle = document.createElement("div");

    clickCircle.className = "click-circle";
    document.body.appendChild(clickCircle);

    document.querySelector(".click-circle");
    const circleRadius = 0.5 * parseInt(
        getComputedStyle(clickCircle)
            .getPropertyValue("--circle-diameter")
            .slice(0, -2)
    );

    clickCircle.style.left = `${event.clientX - circleRadius}px`;
    clickCircle.style.top = `${event.clientY - circleRadius}px`;
    clickCircle.style.animation = `fade-out-opacity .2s  linear`;
    clickCircle.onanimationend = () => {
        document.body.removeChild(clickCircle);
    }
}

function resizeTextArea(textArea) {
    textArea.style.height = 'auto';
    textArea.style.height = textArea.scrollHeight + 'px';
}

function revertsizeTextArea(textArea) {
    textArea.style.height = '';
}

function resizeAllTextAreas(container, listViewEnabled = true) {
    const textAreas = container.querySelectorAll('.data-text, .transform-text');
    if (listViewEnabled) {
        textAreas.forEach(textArea => resizeTextArea(textArea));
    }
    else {
        textAreas.forEach(textArea => revertsizeTextArea(textArea));
    }
}