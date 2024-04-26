let webcamStream = null;
let webcamInterval = null;

let globalCanvas = null;
let ctx = null;

export { initWebcamManagement };

function initWebcamManagement(groupElement) {
    if (groupElement.classList.contains('active')) {
        groupElement.classList.remove('active');
        stopWebcam();
    } else {
        groupElement.classList.add('active');
        startWebcam();
    }
}


function initializeCanvas() {
    globalCanvas = document.createElement('canvas');
    ctx = globalCanvas.getContext('2d');
}

function startWebcam() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            document.querySelectorAll('.webcam-feed')
                .forEach(feed => {
                    feed.srcObject = stream;
                    feed.style.display = 'block';
                    feed.dataset.active = 'true';  // Mark as active
                });
            initializeCanvas();
            startCapture();
        }).catch(console.error);
}


function stopWebcam() {
    if (webcamStream) {
        // Stop all tracks on the webcam stream
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;  // Clear the stream object
    }

    // Select all video elements marked as active and deactivate them
    const webcamFeeds = document.querySelectorAll('.webcam-feed[data-active="true"]');
    webcamFeeds.forEach(feed => {
        feed.style.display = 'none';
        // Remove the media stream from the video element
        feed.srcObject = null;
        // Remove the active marker
        feed.removeAttribute('data-active');
    });

    if (webcamInterval) {
        // Stop the interval that captures images
        clearInterval(webcamInterval);
        webcamInterval = null;
    }
}


function startCapture() {
    webcamInterval = setInterval(() => {
        const activeToggles = document.querySelectorAll('.webcam-toggle-btn.active');
        if (activeToggles.length > 0) {
            captureImageFromWebcam();
        }
    }, 5000);
}

async function captureImageFromWebcam() {
    const videoElements = document.querySelectorAll('.webcam-feed[data-active="true"]'); // Only active feeds

    for (let videoElement of videoElements) {
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        globalCanvas.width = width;
        globalCanvas.height = height;

        ctx.drawImage(videoElement, 0, 0, width, height);

        const blob = await new Promise(resolve => globalCanvas.toBlob(resolve, 'image/jpeg'));
        const groupElement = createGroupAndAddGroupElement(GROUP_TYPE.IMPORTED_IMAGE);
        const group = groupsMap.GROUPS.get(getGroupIdFromElement(groupElement));

        handleDroppedImage(blob, group, groupElement);
    }
}


