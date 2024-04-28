const INTERVAL = 30000;

let webcamStreams = new Map();
let webcamInterval = null;
let globalCanvas = null;
let activeWebcamCount = 0;
let ctx = null;
let lastManualCaptureTime = new Map();  // Tracks the last manual capture time for each group

import { handleDroppedImage } from "./input-change.js"

export { startWebcam, stopWebcam, captureAndHandle, listVideoInputs };

function initializeCanvas() {
    if (!globalCanvas) {
        globalCanvas = document.createElement('canvas');
        ctx = globalCanvas.getContext('2d');
    }
}
async function startWebcam(groupElement, deviceId = null) {
    initializeCanvas();
    const feed = groupElement.querySelector('.webcam-feed');
    const videoZone = groupElement.querySelector(".video-zone");
    const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : true };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        feed.srcObject = stream;
        videoZone.style.display = 'block';
        feed.dataset.active = 'true';
        webcamStreams.set(groupElement, stream);

        // Increase active webcam count
        if (activeWebcamCount === 0) {
            navigator.mediaDevices.ondevicechange = async () => {
                await updateDeviceList();
            };
        }
        activeWebcamCount++;

        feed.oncanplay = () => {
            if (feed.readyState >= 2) {
                captureAndHandle(groupElement);
            }
            if (!webcamInterval) {
                startCapture();
            }
        };
    } catch (error) {
        console.error('Error starting webcam:', error);
    }
}

function stopWebcam(groupElement) {
    const feed = groupElement.querySelector('.webcam-feed');
    const videoZone = groupElement.querySelector(".video-zone");

    const stream = webcamStreams.get(groupElement);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        webcamStreams.delete(groupElement);
    }
    videoZone.style.display = 'none';
    feed.srcObject = null;
    feed.removeAttribute('data-active');

    // Decrease active webcam count
    activeWebcamCount--;
    if (activeWebcamCount === 0 && navigator.mediaDevices.ondevicechange) {
        navigator.mediaDevices.ondevicechange = null;
    }

    if (webcamStreams.size === 0 && webcamInterval) {
        clearInterval(webcamInterval);
        webcamInterval = null;
    }
}


function startCapture() {
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

    if (feed.readyState >= 2) {
        const blob = await captureImageFromWebcam(feed);
        handleDroppedImage(blob, groupElement);
        lastManualCaptureTime.set(groupElement, Date.now());  // Set the time of manual capture
    }
}

async function captureImageFromWebcam(feed) {
    const width = feed.videoWidth;
    const height = feed.videoHeight;

    globalCanvas.width = width;
    globalCanvas.height = height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    ctx.drawImage(feed, 0, 0, width, height);
    ctx.restore();

    return new Promise(resolve => globalCanvas.toBlob(resolve, 'image/jpeg'));
}

async function listVideoInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
}

async function updateDeviceList() {
    const devices = await listVideoInputs();
    document.querySelectorAll('.webcam-feed[data-active="true"]').forEach(groupElement => {
        const select = groupElement.closest('.group').querySelector('sl-select');
        const currentDeviceId = select.value;
        const deviceSelectionContainer = groupElement.closest('.group').querySelector('.device-selection');

        // Clear existing options
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        // Add new device options
        devices.forEach(device => {
            let optionElement = document.createElement('sl-option');
            optionElement.value = device.deviceId;
            optionElement.textContent = device.label;
            select.appendChild(optionElement);
        });

        // Update visibility of select based on the number of devices
        deviceSelectionContainer.style.display = devices.length > 1 ? 'block' : 'none';

        // Check if the current device is still available
        if (!devices.some(device => device.deviceId === currentDeviceId)) {
            if (devices.length > 0) {
                startWebcam(groupElement.closest('.group'), devices[0].deviceId);
            } else {
                stopWebcam(groupElement.closest('.group'));
                revertToStaticImageGroup(groupElement.closest('.group'));
            }
        }
    });
}

function revertToStaticImageGroup(groupElement) {
    const videoZone = groupElement.querySelector('.video-zone');
    videoZone.style.display = 'none';
    const startWebcamButton = groupElement.querySelector('.start-webcam-btn');
    startWebcamButton.style.display = 'block';
    const stopWebcamButton = groupElement.querySelector('.stop-webcam-btn');
    stopWebcamButton.style.display = 'none';
    const captureWebcamFrameButton = groupElement.querySelector('.capture-webcam-frame-btn');
    captureWebcamFrameButton.style.display = 'none';
    const dropZone = groupElement.querySelector('.drop-zone');
    dropZone.style.display = 'block';
}

