import Macy from 'https://cdn.jsdelivr.net/npm/macy@2.5.1/+esm';

let macyMostUsedApps, macyRecentlyUsedApps;

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {
    macyMostUsedApps = new Macy({
        container: '.most-used-apps',
        trueOrder: false,
        waitForImages: false,
        margin: 24,
        columns: 4,
        breakAt: {
            1200: 3,
            940: 2,
            520: 1
        }
    });

    macyRecentlyUsedApps = new Macy({
        container: '.recently-used-apps',
        trueOrder: false,
        waitForImages: false,
        margin: 24,
        columns: 4,
        breakAt: {
            1200: 3,
            940: 2,
            520: 1
        }
    });

    // Recalculate Macy layout after all images are loaded
    window.addEventListener('load', () => {
        macyMostUsedApps.recalculate(true);
        macyRecentlyUsedApps.recalculate(true);
    });
};
