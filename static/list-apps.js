import { GROUP_TYPE } from "./group-utils.js";

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

        const groupIconImgElements = app.groupstypes.map(type => {

            let icon

            switch (type) {

                case GROUP_TYPE.BREAK:
                    icon = "break.svg"
                    break;

                case GROUP_TYPE.STATIC:
                    icon = "text-static.svg"
                    break;

                case GROUP_TYPE.IMPORTED_IMAGE:
                    icon = "imported-image.svg"
                    break;
                case GROUP_TYPE.IMAGE:
                    icon = "image-gen.svg"
                    break;

                case GROUP_TYPE.TEXT:
                    icon = "text-gen.svg"
                    break;

                default:
                    icon = "text-gen.svg"
            };

            const iconpath = "/icons/"

            const iconElement = document.createElement("img");
            iconElement.src = iconpath + icon;
            iconElement.classList.add("group-type-icon");

            return iconElement;

        });


        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = app.link;
        link.textContent = app.name;
        listItem.appendChild(link);
        groupIconImgElements.forEach(element => {
            link.appendChild(element)
        });
        list.appendChild(listItem);
    }

    container.appendChild(list);
    document.body.appendChild(container);
}
