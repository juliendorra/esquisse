import { GROUP_TYPE } from "./group-utils.js";
import Macy from 'https://cdn.jsdelivr.net/npm/macy@2.5.1/+esm';

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
    // Create the container for the list
    const container = document.createElement('div');
    container.className = 'apps-list-container';

    // Add a title
    const title = document.createElement('h2');
    title.textContent = username ? `${username}'s apps` : 'Your apps';
    title.classList.add("apps-page-title")
    container.appendChild(title);

    // Create the list
    const list = document.createElement('ul');
    list.classList.add("apps-list");

    for (const app of apps) {

        console.log(app);

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


        const listItem = document.createElement('li');
        const link = document.createElement('a');
        const appName = document.createElement('div');

        appName.textContent = app.name;

        link.href = app.link;
        link.appendChild(appName);

        groupIconImgElements.forEach(element => {
            link.appendChild(element)
        });

        listItem.appendChild(link);

        list.appendChild(listItem);
    }

    container.appendChild(list);
    document.body.appendChild(container);

    Macy({
        container: '.apps-list',
        trueOrder: false,
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

}
