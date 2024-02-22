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
        const response = await fetch('/list-apps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        //   { currentuser, appscreator, apps }
        const appListData = await response.json();

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
        createAppsList(appListData.apps, appListData.appscreator, appListData.currentuser, hideDeletedApps);

        window.scroll({
            top: scrollY
        });

    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
};

async function createAppsList(apps, appscreator, currentuser, hideDeletedApps = true) {

    // Add a title
    const title = document.querySelector(".apps-page-title");
    title.textContent = appscreator !== currentuser ? `${appscreator}'s apps` : 'Your apps';

    // Create the list
    const appList = document.querySelector(".apps-list");

    appList.textContent = '';

    apps.sort(sortTextByAscendingOrder);

    for (const app of apps) {

        console.log(app);

        const groupIcons = document.createElement('div');
        groupIcons.classList.add("group-icons");

        const groupIconImgElements = app.groupstypes.map(
            (type, index) => {

                let icon;

                let brElement;

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

                const iconElement = document.createElement("img");
                iconElement.src = iconpath + icon;
                iconElement.classList.add("group-type-icon");

                let wrapper = document.createElement("span");

                if (index === 0 && type === GROUP_TYPE.BREAK) {

                    wrapper.appendChild(iconElement)
                    wrapper.appendChild(document.createElement("br"))

                }
                else if (index !== 0 && type === GROUP_TYPE.BREAK) {

                    wrapper.appendChild(document.createElement("br"))
                    wrapper.appendChild(iconElement)
                    wrapper.appendChild(document.createElement("br"))

                }
                else {

                    wrapper.appendChild(iconElement)

                }

                return wrapper;
            });

        groupIconImgElements.forEach(element => {
            groupIcons.appendChild(element)
        });

        const appAsListItem = document.createElement('li');
        const header = document.createElement('div');
        const appName = document.createElement('div');

        appName.classList.add("app-name");
        appName.textContent = app.name;

        if (appscreator === currentuser) {
            header.innerHTML = app.isdeleted ? DELETED_APP_HEADER : LIVE_APP_HEADER;
        }

        header.classList.add("app-header");
        appAsListItem.appendChild(header);

        if (app.isdeleted) {
            appAsListItem.appendChild(appName);
            appAsListItem.appendChild(groupIcons);
        }
        else {
            const link = document.createElement('a');
            link.href = app.link;
            link.appendChild(appName);
            link.appendChild(groupIcons);
            appAsListItem.appendChild(link);
        }

        const deleteButton = header.querySelector(".delete-app-btn");
        deleteButton?.addEventListener("click", (event) => { deleteApp(app.appid, appAsListItem) });

        const recoverAppButton = header.querySelector(".recover-app-btn");
        recoverAppButton?.addEventListener("click", (event) => { recoverApp(app.appid, appAsListItem, app.recoverablegroups) });

        const cloneAppButton = header.querySelector(".clone-app-btn");
        cloneAppButton?.addEventListener("click", (event) => { cloneApp(app.appid, appAsListItem) });

        appAsListItem.dataset.status = app.isdeleted ? "deleted-app" : "live-app";

        if (hideDeletedApps) {
            appAsListItem.style.display = app.isdeleted ? "none" : "list-item";
        }
        else {
            appAsListItem.style.display = !app.isdeleted ? "none" : "list-item";
        }

        appList.appendChild(appAsListItem);

        macyInstance.recalculate(true);
    }

}

async function deleteApp(appid, appListItemElement) {

    console.log("[DELETING] Persisting as empty app on server, appid: ", appid);

    const body = JSON.stringify(
        {
            id: appid,
            groups: { "version": "2023-11-05", "groups": [] },
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

async function recoverApp(appid, appListItemElement, recoverablegroups) {

    console.log("[RECOVERING] Persisting the last non-empty version on server, appid: ", appid);

    const body = JSON.stringify(
        {
            id: appid,
            groups: { "version": "2023-11-05", "groups": recoverablegroups },
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
                init(false, scrollY);
            })


    } catch (error) {
        console.error("Error in persisting groups", error);
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