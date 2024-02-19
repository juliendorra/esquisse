import { GROUP_TYPE } from "./group-utils.js";
import Macy from 'https://cdn.jsdelivr.net/npm/macy@2.5.1/+esm';

const APP_HEADER = `
<button class="tool-btn delete-btn" aria-label="Delete"><img src="/icons/delete.svg"></button>
`

let macyInstance;

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

async function init() {

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

        const apps = await response.json();

        // Create the list of apps
        createAppsList(apps, username);
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
};

function createAppsList(apps, username) {

    // Add a title
    const title = document.querySelector(".apps-page-title");
    title.textContent = username ? `${username}'s apps` : 'Your apps';

    // Create the list
    const appList = document.querySelector(".apps-list");

    for (const app of apps) {

        if (app.groupstypes.length === 0) { continue }

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
        const link = document.createElement('a');
        const appName = document.createElement('div');

        appName.classList.add("app-name");
        appName.textContent = app.name;

        link.href = app.link;
        link.appendChild(appName);
        link.appendChild(groupIcons);

        header.innerHTML = APP_HEADER;
        header.classList.add("app-header");

        appAsListItem.appendChild(header);
        appAsListItem.appendChild(link);

        const deleteButton = header.querySelector(".delete-btn");
        deleteButton.addEventListener("click", (event) => { deleteApp(app.appid, appAsListItem) });

        appList.appendChild(appAsListItem);

        macyInstance.recalculate();
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
        appListItemElement.remove();

        macyInstance.recalculate(true);

    } catch (error) {
        console.error("Error in persisting groups", error);
    }

}