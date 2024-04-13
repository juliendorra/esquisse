import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkeys-js@3/+esm';

export { displayAlert, hideAddBlocksButtons, showAddBlocksButtons, removeGlobalWaitingIndicator, createZoomedImage, setShortcuts };

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