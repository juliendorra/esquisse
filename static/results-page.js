if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {

    const thumbnailImages = document.querySelectorAll(".result-preview");

    for (const thumbnailImage of thumbnailImages) {
        thumbnailImage.addEventListener(
            'error',
            (event) => {
                // targeting the <li> grand-parent
                event.currentTarget.parentElement.parentElement.style.display = 'none';
            }
        );
    }
}


