import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkeys-js@3/+esm';

export { displayAlert, hideAddBlocksButtons, showAddBlocksButtons, removeGlobalWaitingIndicator, createZoomedImage, createZoomedIframe, setShortcuts, resizeTextArea, resizeAllTextAreas, getCaretCoordinates };

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

    zoomedContainer.addEventListener("click", () => {
        document.body.classList.remove('no-scroll');
        zoomedContainer.remove();

    });

    let closeButton = document.createElement('button');
    closeButton.classList.add('close-zoomed', 'footer-btn');

    closeButton.innerHTML = `
        <span class="text-btn">Close</span>
        <span class="icon-btn">
        <img src="/icons/delete.svg">
        </span>
        `

    closeButton.addEventListener("click", () => {
        document.body.classList.remove('no-scroll');
        zoomedContainer.remove();
    });

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

// https://github.com/component/textarea-caret-position

// We'll copy the properties below into the mirror div.
// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
const properties = [
    'direction',  // RTL support
    'boxSizing',
    'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
    'height',
    'overflowX',
    'overflowY',  // copy the scrollbar for IE

    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',

    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',

    // https://developer.mozilla.org/en-US/docs/Web/CSS/font
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',

    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',  // might not make a difference, but better be safe

    'letterSpacing',
    'wordSpacing',

    'tabSize',
    'MozTabSize'

];

const isBrowser = (typeof window !== 'undefined');
const isFirefox = (isBrowser && window.mozInnerScreenX != null);

function getCaretCoordinates(element, position, options) {

    if (!isBrowser) {
        throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
    }

    const debug = options && options.debug || false;
    if (debug) {
        const el = document.querySelector('#input-textarea-caret-position-mirror-div');
        if (el) el.parentNode.removeChild(el);
    }

    // The mirror div will replicate the textarea's style
    const div = document.createElement('div');
    div.id = 'input-textarea-caret-position-mirror-div';
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9
    const isInput = element.nodeName === 'INPUT';

    // Default textarea styles
    style.whiteSpace = 'pre-wrap';
    if (!isInput)
        style.wordWrap = 'break-word';  // only for textarea-s

    // Position off-screen
    style.position = 'absolute';  // required to return coordinates properly
    if (!debug)
        style.visibility = 'hidden';  // not 'display: none' because we want rendering

    // Transfer the element's properties to the div
    properties.forEach(function (prop) {
        if (isInput && prop === 'lineHeight') {
            // Special case for <input>s because text is rendered centered and line height may be != height
            if (computed.boxSizing === "border-box") {
                const height = parseInt(computed.height);
                const outerHeight =
                    parseInt(computed.paddingTop) +
                    parseInt(computed.paddingBottom) +
                    parseInt(computed.borderTopWidth) +
                    parseInt(computed.borderBottomWidth);
                const targetHeight = outerHeight + parseInt(computed.lineHeight);
                if (height > targetHeight) {
                    style.lineHeight = height - outerHeight + "px";
                } else if (height === targetHeight) {
                    style.lineHeight = computed.lineHeight;
                } else {
                    style.lineHeight = 0;
                }
            } else {
                style.lineHeight = computed.height;
            }
        } else {
            style[prop] = computed[prop];
        }
    });

    if (isFirefox) {
        // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
        if (element.scrollHeight > parseInt(computed.height))
            style.overflowY = 'scroll';
    } else {
        style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
    }

    div.textContent = element.value.substring(0, position);
    // The second special handling for input type="text" vs textarea:
    // spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
    if (isInput)
        div.textContent = div.textContent.replace(/\s/g, '\u00a0');

    const span = document.createElement('span');
    // Wrapping must be replicated *exactly*, including when a long word gets
    // onto the next line, with whitespace at the end of the line before (#7).
    // The  *only* reliable way to do that is to copy the *entire* rest of the
    // textarea's content into the <span> created at the caret position.
    // For inputs, just '.' would be enough, but no need to bother.
    span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
    div.appendChild(span);

    const coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth']),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        height: parseInt(computed['lineHeight'])
    };

    if (debug) {
        span.style.backgroundColor = '#aaa';
    } else {
        document.body.removeChild(div);
    }

    return coordinates;
}


