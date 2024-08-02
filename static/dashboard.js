async function fetchData(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

function displayList(data, elementId) {
    const ul = document.getElementById(elementId);
    ul.innerHTML = '';
    data.forEach(item => {
        const li = document.createElement('li');
        if (typeof item === 'object' && item !== null) {
            if ('username' in item) {
                const userLink = document.createElement('a');
                userLink.href = `/apps/${item.username}`;
                userLink.textContent = `${item.username}: ${item.count}`;
                li.appendChild(userLink);
            } else if ('appid' in item) {
                const appLink = document.createElement('a');
                appLink.href = `${item.link}`;
                appLink.textContent = `${item.appid}: ${item.count}`;
                li.appendChild(appLink);
            }
        } else {
            li.textContent = item;
        }
        ul.appendChild(li);
    });
}

async function updateDashboard() {
    try {
        const lastActiveUsers = await fetchData('/list-last-active-users');
        const mostActiveUsers = await fetchData('/list-most-active-users');
        const mostUsedApps = await fetchData('/list-most-used-apps');

        displayList(lastActiveUsers, 'lastActiveUsers');
        displayList(mostActiveUsers, 'mostActiveUsers');
        displayList(mostUsedApps, 'mostUsedApps');
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

document.addEventListener('DOMContentLoaded', updateDashboard);