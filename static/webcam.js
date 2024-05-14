const INTERVAL = 30000;

let webcamStreams = new Map();
let webcamInterval = null;
let globalCanvas = null;
let activeWebcamGroupsCount = 0;
let ctx = null;
let lastManualCaptureTime = new Map();  // Tracks the last manual capture time for each group

import { handleDroppedImage } from "./input-change.js"

export { turnIntoWebcamGroup, startWebcam, stopWebcam, switchWebcam, captureAndHandle, flipImageResult, listVideoInputs };

function initializeCanvas() {
    if (!globalCanvas) {
        globalCanvas = document.createElement('canvas');
        ctx = globalCanvas.getContext('2d');
    }
}
async function startWebcam(groupElement, deviceId) {

    await navigator.mediaDevices.getUserMedia({ video: true });

    initializeCanvas();
    const feed = groupElement.querySelector('.webcam-feed');
    const videoZone = groupElement.querySelector(".video-zone");

    try {
        // Use listVideoInputs to fetch available devices
        const videoInputs = await listVideoInputs();
        if (videoInputs.length === 0) {
            throw new Error("No video input devices found.");
        }

        // Determine the device to use
        let deviceToUse = videoInputs[0];  // Default to the first device if no deviceId is specified
        if (deviceId) {
            const requestedDevice = videoInputs.find(device => device.deviceId === deviceId);
            if (requestedDevice) {
                deviceToUse = requestedDevice;
            }
        }

        // Set up the constraints for getUserMedia
        const constraints = { video: { deviceId: { exact: deviceToUse.deviceId } } };

        // Access the stream with the specified device
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        feed.srcObject = stream;
        videoZone.style.display = 'block';
        feed.dataset.active = 'true';
        webcamStreams.set(groupElement, stream);

        // Increase active webcam count and handle device changes
        if (activeWebcamGroupsCount === 0) {

            navigator.mediaDevices.ondevicechange = async () => {
                updateDeviceList();
            };
        }

        activeWebcamGroupsCount++;

        feed.oncanplay = () => {
            if (feed.readyState >= 2) {
                captureAndHandle(groupElement);
            }

            if (!webcamInterval) {
                startCaptureInterval();
            }
        };

        turnIntoWebcamGroup(groupElement);
        populateWebcamSelect(groupElement, videoInputs);

    } catch (error) {
        console.error('[WEBCAM] Error starting webcam:', error);
        stopWebcam(groupElement);
    }
}

function stopWebcam(groupElement) {
    const stream = webcamStreams.get(groupElement);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        webcamStreams.delete(groupElement);
    }

    const feed = groupElement.querySelector('.webcam-feed');
    feed.srcObject = null;
    feed.removeAttribute('data-active');

    // Decrease active webcam count
    activeWebcamGroupsCount--;
    if (activeWebcamGroupsCount === 0 && navigator.mediaDevices.ondevicechange) {
        navigator.mediaDevices.ondevicechange = null;
    }

    if (webcamStreams.size === 0 && webcamInterval) {
        clearInterval(webcamInterval);
        webcamInterval = null;
    }

    revertToStaticImageGroup(groupElement);
}

async function switchWebcam(groupElement, deviceId) {
    const feed = groupElement.querySelector('.webcam-feed');
    if (!feed) {
        console.error("[WEBCAM] No webcam feed found in the group element.");
        return;
    }

    // Check if there's an existing stream and stop all its tracks
    const existingStream = feed.srcObject;
    if (existingStream) {
        existingStream.getTracks().forEach(track => track.stop());
    }

    // Set up the constraints for getUserMedia with the new device
    const constraints = { video: { deviceId: { exact: deviceId } } };

    try {
        // Request the stream from the new device
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        feed.srcObject = newStream;
        webcamStreams.set(groupElement, newStream);  // Update the stream map

        const select = groupElement.querySelector('sl-select');
        select.value = deviceId;

        feed.onloadedmetadata = () => {
            console.log("[WEBCAM] Webcam switched and stream ready.");
            feed.play();
        };
    } catch (error) {
        console.error('[WEBCAM] Error switching webcam:', error);
    }
}

function startCaptureInterval() {
    webcamInterval = setInterval(() => {
        document.querySelectorAll('.group:has(.webcam-feed[data-active="true"])').forEach(groupElement => {
            const lastCapture = lastManualCaptureTime.get(groupElement);
            if (!lastCapture || Date.now() - lastCapture > INTERVAL) {
                captureAndHandle(groupElement);
            }
        });
    }, INTERVAL);
}

async function captureAndHandle(groupElement) {

    const feed = groupElement.querySelector('.webcam-feed');

    const isMirrored = groupElement.classList.contains("mirrored-video");

    if (feed.readyState >= 2) {
        const blob = await captureImageFromWebcam(feed, isMirrored);
        handleDroppedImage(blob, groupElement);
        lastManualCaptureTime.set(groupElement, Date.now());  // Set the time of manual capture
    }
}

async function captureImageFromWebcam(feed, captureMirrored = false) {
    const width = feed.videoWidth;
    const height = feed.videoHeight;

    globalCanvas.width = width;
    globalCanvas.height = height;

    ctx.save();

    if (captureMirrored) {
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
    }

    ctx.drawImage(feed, 0, 0, width, height);
    ctx.restore();

    return new Promise(resolve => globalCanvas.toBlob(resolve, 'image/jpeg'));
}

async function flipImageResult(groupElement) {

    const result = groupElement.querySelector('img.result');

    if (!result) {
        console.error("[FLIP CANVAS] No image result img src found in the group element.");
        return;
    }

    const image = new Image();
    image.src = result.src;

    image.onload = async () => {
        const width = image.width;
        const height = image.height;

        globalCanvas.width = width;
        globalCanvas.height = height;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(image, -width, 0, width, height);
        ctx.restore();

        globalCanvas.toBlob(flippedBlob => {
            handleDroppedImage(flippedBlob, groupElement);
        }, 'image/jpeg');
    };

    image.onerror = () => {
        console.error("[FLIP CANVAS] Error loading the image.");
        URL.revokeObjectURL(blobUrl);
    };
}


async function listVideoInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    console.log("[WEBCAM] enumerated video devices: ", videoDevices)
    return videoDevices;
}

async function updateDeviceList() {

    const devices = await listVideoInputs();

    document.querySelectorAll('.group:has(.webcam-feed[data-active="true"])').forEach(groupElement => {

        populateWebcamSelect(groupElement, devices)

    });
}

function populateWebcamSelect(groupElement, devices) {
    const select = groupElement.querySelector('sl-select');
    if (!select) return;  // Skip if no select element is present.

    const currentDeviceId = select.value;

    const optionElements = select.querySelectorAll("sl-option")

    const existingDeviceIds = new Set();
    for (const option of optionElements) {
        existingDeviceIds.add(option.value);
        if (!devices.some(device => device.deviceId === option.value)) {
            console.log("[WEBCAM] removing option: ", option);
            option.remove();
        }
    }

    // Populate the select with new device options
    devices.forEach(device => {
        if (!existingDeviceIds.has(device.deviceId)) {
            const optionElement = document.createElement('sl-option');
            optionElement.value = device.deviceId;
            optionElement.textContent = device.label;
            select.appendChild(optionElement);
        }
    });

    // Display the select only if multiple devices are available
    const deviceSelectionContainer = groupElement.querySelector('.device-selection');
    deviceSelectionContainer.style.display = devices.length > 1 ? 'block' : 'none';

    // Automatically select the first device if the previous device is no longer available
    if (!devices.some(device => device.deviceId === currentDeviceId)) {
        if (devices.length > 0) {
            switchWebcam(groupElement, devices[0].deviceId);
        } else {
            stopWebcam(groupElement);
        }
    }
}

async function turnIntoWebcamGroup(groupElement) {

    const startWebcamButton = groupElement.querySelector('.start-webcam-btn');
    const stopWebcamButton = groupElement.querySelector('.stop-webcam-btn');
    const captureWebcamFrameButton = groupElement.querySelector('.capture-webcam-frame-btn');
    const dropZone = groupElement.querySelector(".drop-zone");

    startWebcamButton.style.display = 'none';
    stopWebcamButton.style.display = 'block';
    captureWebcamFrameButton.style.display = 'block';
    dropZone.style.display = 'none';
}

function revertToStaticImageGroup(groupElement) {
    const videoZone = groupElement.querySelector('.video-zone');
    videoZone.style.display = 'none';

    // Clear webcam options
    const optionElements = groupElement.querySelectorAll("sl-option")

    for (const option of optionElements) {
        console.log("[WEBCAM] removing option: ", option)
        option.remove();
    }

    const startWebcamButton = groupElement.querySelector('.start-webcam-btn');
    startWebcamButton.style.display = 'block';

    const stopWebcamButton = groupElement.querySelector('.stop-webcam-btn');
    stopWebcamButton.style.display = 'none';

    const captureWebcamFrameButton = groupElement.querySelector('.capture-webcam-frame-btn');
    captureWebcamFrameButton.style.display = 'none';

    const dropZone = groupElement.querySelector('.drop-zone');
    dropZone.style.display = 'block';
}

