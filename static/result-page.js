
import { addMiniviewButtonsListeners } from "./reordering.js";

import { initMeshBackground } from "./mesh-background.js";

// Call the init function when the page loads

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {

    initMeshBackground();

    addMiniviewButtonsListeners();

    document.getElementById('share-btn')?.addEventListener('click', function () {
        // Check if the Web Share API is supported
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            }).then(() => {
                console.log('[SETTINGS MENU] URL shared');
            })
                .catch(console.error);
        } else {
            // Fallback to Clipboard API
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    displayAlert(
                        {
                            issue: "Link to this app copied!",
                            action: "Paste the link to share your app.",
                            variant: "success",
                            icon: "person-arms-up",
                            duration: 3000
                        }
                    )
                })
                .catch(console.error);
        }
    });




}
