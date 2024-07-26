import { GROUP_TYPE } from "./group-utils.js";
import Macy from 'https://cdn.jsdelivr.net/npm/macy@2.5.1/+esm';

const LIVE_APP_HEADER = `
<button class="tool-btn clone-app-btn" aria-label="Clone"><img src="/icons/clone.svg"></button>
<button class="tool-btn delete-app-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
`
const DELETED_APP_HEADER = `
<button class="tool-btn recover-app-btn" aria-label="Recover app"><img src="/icons/recover-app.svg"></button>
`

const DELETED_APP_SWITCH = `
<sl-switch class="quality-switch"></sl-switch>&nbsp;Show&nbsp;deleted&nbsp;apps
`

let macyInstance;

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    addGlobalWaitingIndicator();
    init(true);
}

async function init(hideDeletedApps = true, scrollY = 0) {

    const path = window.location.pathname;
    const pathParts = path.split('/');
    let username = null;

    if (pathParts.length === 3 && pathParts[1] === 'apps') {
        username = pathParts[2];
    }

    macyInstance = Macy({
        container: '.apps-list',
        trueOrder: true,
        waitForImages: false,
        margin: 24,
        columns: 4,
        breakAt: {
            1400: 4,
            1000: 3,
            940: 2,
            520: 1
        }
    });

    const payload = username ? { username } : {};

    try {

        const responseApps = fetch('/list-apps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseResults = fetch('/list-results', {
            method: 'GET',
        });

        const [apps, results] = await Promise.allSettled([responseApps, responseResults]);

        console.log(apps, results);

        if (!results.status === 'fulfilled' || !results.value.ok) {
            throw new Error(results);
        }

        if (!apps.status === 'fulfilled' || !apps.value.ok) {
            throw new Error(apps);
        }

        //  App data is: { currentuser, appscreator, apps }
        const appListData = await apps.value.json();
        // results data is [{resultid,username,timestamp,appid,appversiontimestamp},...]
        const resultListData = await results.value.json();

        const deletedAppsSwitch = document.querySelector(".deleted-apps-switch");

        if (appListData.appscreator === appListData.currentuser) {

            deletedAppsSwitch.innerHTML = DELETED_APP_SWITCH;

            deletedAppsSwitch.addEventListener('sl-change', (event) => {

                const appList = document.querySelector(".apps-list");

                const deletedApps = appList.querySelectorAll("li[data-status='deleted-app']");
                const liveApps = appList.querySelectorAll("li[data-status='live-app']");

                if (event.target.checked) {
                    for (const appElement of deletedApps) {
                        appElement.style.display = "list-item";
                    }
                    for (const appElement of liveApps) {
                        appElement.style.display = "none";
                    }
                    macyInstance.recalculate(true);
                }
                else {
                    for (const appElement of deletedApps) {
                        appElement.style.display = "none";
                    }
                    for (const appElement of liveApps) {
                        appElement.style.display = "list-item";
                    }
                    macyInstance.recalculate(true);
                }
            });
        };

        // has the scrolled changed since a delete?
        scrollY = scrollY !== window.scrollY ? window.scrollY : scrollY;

        // Create the list of apps
        createAppsList(
            {
                apps: appListData.apps,
                appscreator: appListData.appscreator,
                currentuser: appListData.currentuser,
                hideDeletedApps: hideDeletedApps,
                results: resultListData
            }
        );

        window.scroll({
            top: scrollY
        });

    } catch (error) {
        console.error('Error fetching apps:', JSON.stringify(error));
    }
};

function createAppsList({ apps, appscreator, currentuser, hideDeletedApps = true, results }) {

    const pageTitle = appscreator !== currentuser ? `${appscreator}'s apps` : 'Your apps';

    // Name the page
    document.title = `${pageTitle} · Esquisse AI`;

    // Add a title
    const title = document.querySelector(".apps-page-title");
    title.textContent = pageTitle;

    // Create the list
    const appList = document.querySelector(".apps-list");

    appList.textContent = '';

    apps.sort(sortTextByAscendingOrder);

    let allAppAsListItemsHTML = [];

    for (const app of apps) {

        // console.log(app);

        const groupIconImgHTML = app.groupstypes.map(
            (type, index) => {

                let icon;

                switch (type) {

                    case GROUP_TYPE.BREAK:
                        icon = "break.svg";
                        break;

                    case GROUP_TYPE.STATIC:
                        icon = "text-static.svg";
                        break;

                    case GROUP_TYPE.IMPORTED_IMAGE:
                        icon = "imported-image.svg";
                        break;
                    case GROUP_TYPE.IMAGE:
                        icon = "image-gen.svg";
                        break;

                    case GROUP_TYPE.TEXT:
                        icon = "text-gen.svg";
                        break;

                    default:
                        icon = "text-gen.svg";
                };

                const iconpath = "/icons/"
                const iconElementHTML = `<img src="${iconpath}${icon}" class="group-type-icon">`;

                let wrapper;

                if (index === 0 && type === GROUP_TYPE.BREAK) {

                    wrapper = `
                            <span>${iconElementHTML}</span>
                            <br />
                            `
                }
                else if (index !== 0 && type === GROUP_TYPE.BREAK) {

                    wrapper = `
                            <br />
                            <span>${iconElementHTML}</span>
                            <br />
                            `
                }
                else {
                    wrapper = `<span>${iconElementHTML}</span>`
                }

                return wrapper;
            });

        const appNameHTML = `<div class="app-name">${app.name}</div>`

        const groupIconsHTML = `<div class="group-icons">${groupIconImgHTML.join("")}</div>`

        let headerHTML = "";

        if (appscreator === currentuser) {
            headerHTML = `<div class="app-header">${app.isdeleted ? DELETED_APP_HEADER : LIVE_APP_HEADER}</div>`
        }

        let AppResultsListHTML = "";

        if (results.length > 0) {
            AppResultsListHTML = getAppResultsListHTML(app.appid, results);
        }

        let appAsListItemHTML = "";

        if (app.isdeleted) {

            appAsListItemHTML = ` 
            <li data-appid="${app.appid}" data-status="${app.isdeleted ? 'deleted-app' : 'live-app'}">
            ${headerHTML}
            ${appNameHTML}
            ${groupIconsHTML}
            ${AppResultsListHTML}
            </li> 
            `
        }
        else {
            appAsListItemHTML = ` 

            <li data-appid="${app.appid}" data-status="${app.isdeleted ? 'deleted-app' : 'live-app'}">
            ${headerHTML}
            <a href="${app.link}">
            ${appNameHTML}
            ${groupIconsHTML}
            </a>
            ${AppResultsListHTML}
            </li> 
            `
        }

        allAppAsListItemsHTML.push(appAsListItemHTML)

    }

    appList.innerHTML = allAppAsListItemsHTML.join("");

    removeGlobalWaitingIndicator();

    addEventListeners(appList)

    hideApps(appList, hideDeletedApps);

    macyInstance.recalculate(true);

}

function addEventListeners(appListElement) {

    const appItems = appListElement.querySelectorAll("li");

    for (const appAsListItem of appItems) {

        const appResultsList = appAsListItem.querySelector(".results-list");

        if (appResultsList) {

            // wait for the repaint before calculating overflows

            requestAnimationFrame(
                () => {
                    appResultsList.classList.remove("overflow-left");
                    appResultsList.classList.remove("overflow-right");

                    if (isOverflowingOnLeft(appResultsList)) {
                        appResultsList.classList.add("overflow-left");
                    }
                    if (isOverflowingOnRight(appResultsList)) {
                        appResultsList.classList.add("overflow-right");
                    }
                }
            )

            appResultsList.addEventListener(
                "scroll",
                (event) => {
                    event.currentTarget.classList.remove("overflow-left");
                    event.currentTarget.classList.remove("overflow-right");

                    if (isOverflowingOnLeft(event.currentTarget)) {
                        event.currentTarget.classList.add("overflow-left");
                    }
                    if (isOverflowingOnRight(event.currentTarget)) {
                        event.currentTarget.classList.add("overflow-right");
                    }
                }
            );
        }

        const cloneAppButton = appAsListItem.querySelector(".clone-app-btn");
        cloneAppButton?.addEventListener("click", (event) => { cloneApp(appAsListItem.dataset.appid, appAsListItem) });

        const deleteButton = appAsListItem.querySelector(".delete-app-btn");
        deleteButton?.addEventListener("click", (event) => { deleteApp(appAsListItem.dataset.appid, appAsListItem) });

        const recoverAppButton = appAsListItem.querySelector(".recover-app-btn");
        recoverAppButton?.addEventListener("click", (event) => { recoverApp(appAsListItem.dataset.appid, appAsListItem) });

    }
}

function hideApps(appListElement, hideDeletedApps) {

    const appItems = appListElement.querySelectorAll("li");

    for (const appAsListItem of appItems) {
        if (hideDeletedApps) {
            appAsListItem.style.display = appAsListItem.dataset.status === "deleted-app" ? "none" : "list-item";
        }
        else {
            appAsListItem.style.display = appAsListItem.dataset.status === "live-app" ? "none" : "list-item";
        }
    }
}

async function deleteApp(appid, appListItemElement) {

    console.log("[DELETING] Persisting as empty app on server, appid: ", appid);

    const body = JSON.stringify(
        {
            id: appid,
            groups: { version: "2024-03-14", groups: [] },
        }
    );

    try {
        const response = await fetch(
            '/persist',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body,
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // remove app from the list

        appListItemElement.classList.add("just-deleted");

        appListItemElement.addEventListener("transitionend",
            () => {
                appListItemElement.remove();
                const scrollY = window.scrollY;
                init(true, scrollY);
            })

    } catch (error) {
        console.error("Error in persisting groups", error);
    }

}

async function recoverApp(appid, appListItemElement) {

    console.log("[RECOVERING] Recovering to the last non-empty version on server, appid: ", appid);

    const body = JSON.stringify(
        {
            id: appid,
        }
    );

    try {
        const response = await fetch(
            '/recover',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body,
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // remove app from the list

        appListItemElement.classList.add("just-deleted");

        appListItemElement.addEventListener("transitionend",
            () => {
                appListItemElement.remove();
                const scrollY = window.scrollY;
                init(false, scrollY);
            })


    } catch (error) {
        console.error("Error in recovering groups", error);
    }
}

async function cloneApp(appid, appListItemElement) {

    console.log("[CLONING] requesting on clone from the server fo app: ", appid);

    const body = JSON.stringify(
        {
            id: appid,
        }
    );

    try {
        const response = await fetch(
            '/clone',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body,
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        appListItemElement.classList.add("just-cloned");

        const scrollY = window.scrollY;
        init(true, scrollY);

    } catch (error) {
        console.error("Error in persisting groups", error);
    }
}

function getResultHTML(resultId) {

    return `<li>
                <a href="/result/${resultId}">
                <img src="/thumbnail/${resultId}" class="result-preview">
                </a>
             </li>
            `
}


// [{"resultid":"4xmk5m1jzz4tjyc2n","username":"julien","timestamp":"2024-02-22T10:18:50.525Z","appid":"h2jvvdx4tx6x1m","appversiontimestamp":"2024-02-09T09:32:33.920Z"},{"resultid":"bpdhvv8vztqjmtg7p","username":"julien","timestamp":"2024-01-29T08:41:19.907Z","appid":"6mjv7hmw2pys3z","appversiontimestamp":"2024-01-28T22:16:13.893Z"},]

function getAppResultsListHTML(appid, results) {

    const appResults = results.filter(result => result.appid === appid);

    const resultsListItems = appResults.map(result => getResultHTML(result.resultid));

    return `<div class="results-container"><ul class="results-list">${resultsListItems.join("")}</ul></div>`;
}

// Utils

function sortTextByAscendingOrder(a, b) {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }

    // names are equal
    return 0;
};

function isOverflowingOnLeft(element) {
    return element.scrollLeft > 0;
}

function isOverflowingOnRight(element) {
    return element.scrollLeft + element.clientWidth < element.scrollWidth;
}

function addGlobalWaitingIndicator() {
    const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
    fetchingIndicatorElement.classList.add("waiting");
}

function removeGlobalWaitingIndicator() {

    // is there any group or other active element waiting?
    const waitingElement = document.querySelector(".waiting:not(.fetching-indicator)");

    if (!waitingElement) {
        const fetchingIndicatorElement = document.querySelector(".fetching-indicator");
        fetchingIndicatorElement.classList.remove("waiting");
    }
}
