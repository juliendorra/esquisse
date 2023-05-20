import { callGPT } from './gpt.js';

const groups = [];

let requestQueue = {}; // Add a requestQueue object
let lastRequestTime = 0;

const DELAY = 5000;

function updateReferencedResult(groupName, referencedResult) {
    // Find the corresponding group and index
    const groupIndex = groups.findIndex(g => g.name === groupName);
    const groupElement = document.querySelectorAll('.group')[groupIndex];

    let groupSubElements;

    // Get the group sub elements
    if (groupElement) {
        groupSubElements = {
            dataTextarea: groupElement.querySelector('.data-text'),
            refResultTextarea: groupElement.querySelector('.referenced-result-text'),
            transformText: groupElement.querySelector('.transform-text'),
            groupName: groupElement.querySelector('.group-name')
        };
    }

    console.log(`Group ${groupName}|data: ${groupSubElements.dataTextarea.value}|referenced result: ${referencedResult}`)

    // Update the group's data with the referenced result and trigger handleInputChange()
    // only update if the referenced Result is new
    if (groupIndex > -1 && referencedResult !== groupSubElements.refResultTextarea.value) {

        console.log(`updating the group referenced result in refResultTextarea for display only`)

        groupSubElements.refResultTextarea.value = referencedResult ? referencedResult : "";
    }

}


function handleInputChange(group, index, groupElements, immediate = false) {
    console.log('handleInputChange called');

    // updating the values
    console.log(`Updating group at index: ${index}`);
    groups[index].data = groupElements.dataText.value;
    groups[index].transform = groupElements.transformText.value;

    let dataValue = groups[index].data;
    const transformValue = groups[index].transform;

    // Check for a valid reference to a group result in data
    const groupNameMatch = dataValue.match(/#(.+)/);
    let groupName;
    if (groupNameMatch) {
        groupName = groupNameMatch[1];
        const referencedGroup = groups.find(group => group.name === groupName);
        if (referencedGroup && referencedGroup.result) {
            dataValue = referencedGroup.result; // Use the referenced result instead of data
        } else {
            console.log(`No group found with the name ${groupName} or the group's result is not set yet.`);
            return;
        }
    }

    if (dataValue && transformValue) {
        clearTimeout(requestQueue[index]);

        const currentTime = Date.now();
        if (currentTime - lastRequestTime < DELAY && !immediate) {
            const timeout = DELAY - (currentTime - lastRequestTime);
            console.log(`Waiting for ${timeout / 1000} seconds`);

            // clearing the previous timeout
            if (requestQueue[index]) {
                clearTimeout(requestQueue[index]);
            }

            requestQueue[index] = setTimeout(() => {
                handleInputChange(group, index, groupElements, true);
            }, timeout);
            return;
        }

        lastRequestTime = currentTime;

        console.log(`Sending request ${dataValue} ||| ${transformValue}`);

        callGPT(dataValue, transformValue)
            .then((result) => {

                console.log(`Received result: ${result}`);

                groups[index].result = result;

                let resultParagraph = group.querySelector('.result');

                if (!resultParagraph) {
                    resultParagraph = document.createElement('p');
                    resultParagraph.className = 'result';
                    group.appendChild(resultParagraph);
                }

                resultParagraph.textContent = groups[index].result;

                // Update all data textareas with the new result
                document.querySelectorAll('.group').forEach((group, idx) => {

                    const groupElements = {
                        dataText: group.querySelector('.data-text'),
                        refResultTextarea: group.querySelector('.referenced-result-text'),
                    };

                    const groupNameMatch = groupElements.dataText.value.match(/#(.+)/);
                    if (groupNameMatch && groupNameMatch[1] === groups[index].name) {
                        updateReferencedResult(groupNameMatch[1], dataValue);
                    }
                });


                delete requestQueue[index]; // Remove the request from the queue after it's complete
            });
    }
}

function addEventListenersToGroup(group) {

    const index = Array.from(document.querySelectorAll('.group')).indexOf(group);

    console.log("adding listener to group index:", index)

    const groupElements = {
        dataText: group.querySelector('.data-text'),
        refResultTextarea: group.querySelector('.referenced-result-text'),
        transformText: group.querySelector('.transform-text'),
        groupName: group.querySelector('.group-name')
    };

    group.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('input', () => handleInputChange(group, index, groupElements, false));
    });

    group.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('change', () => handleInputChange(group, index, groupElements, true));
    });


    group.querySelector('.group-name').addEventListener('input', (event) => {
        groups[index].name = event.target.value;
        console.log(`Group ${index} name now:${groups[index].name})`)
    });

    // Call the persist function when a group's name, data or transform changes
    groupElements.groupName.addEventListener('change', persistGroups);
    groupElements.dataText.addEventListener('change', persistGroups);
    groupElements.transformText.addEventListener('change', persistGroups);

    const dataTextarea = groupElements.dataText;
    const refResultTextarea = groupElements.refResultTextarea;

    refResultTextarea.style.display = 'none';

    dataTextarea.addEventListener('blur', () => {

        const groupNameMatch = dataTextarea.value.match(/#(.+)/);

        // also check if focus is still inside refResultTextare

        if (groupNameMatch && !refResultTextarea.contains(document.activeElement)) {

            console.log(`${dataTextarea.value} is a valid group name`)
            const groupName = groupNameMatch[1];
            const referencedGroup = groups.find(group => group.name === groupName);

            if (referencedGroup && referencedGroup.result) {

                console.log(`refererenced group: ${referencedGroup.name} `)
                console.log(`${groupName} is an existing group`)
                refResultTextarea.value = referencedGroup.result;
                refResultTextarea.style.display = 'block';
                dataTextarea.style.display = 'none';
            }
        }
    });

    refResultTextarea.addEventListener('focus', () => {
        refResultTextarea.style.display = 'none';
        dataTextarea.style.display = 'block';
        dataTextarea.focus();
    });

    dataTextarea.addEventListener('focus', () => {
        refResultTextarea.style.display = 'none';
    });

}


function addGroupElement() {
    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `
        <input type="text" class="group-name" placeholder="Group Name">
        <textarea class="data-text" placeholder="Data Text"></textarea>
        <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
        <textarea class="transform-text" placeholder="Transform Text"></textarea>
    `;

    const container = document.querySelector('.container');
    container.appendChild(group);

    addEventListenersToGroup(group);
    return group;
}

function addGroupElementAndPushGroup() {

    addGroupElement();

    groups.push({ name: '', data: '', transform: '', result: null });

}

document.querySelector('.add-group-btn').addEventListener('click', addGroupElementAndPushGroup);


function persistGroups() {

    // Omit the results and only include {name, data, transform}
    const strippedGroups = groups.map(({ name, data, transform }) => ({ name, data, transform }));

    // Convert to JSON and then to Base64
    const base64Groups = btoa(JSON.stringify(strippedGroups));

    console.log(groups, base64Groups)

    // Update the URL with the encoded groups
    window.location.hash = base64Groups;
}

function loadGroups() {
    const base64Groups = window.location.hash.slice(1);  // Get the hash and remove the '#'

    if (!base64Groups) {
        addGroupElementAndPushGroup();
        return;
    }

    try {
        // Decode and parse the groups
        const strippedGroups = JSON.parse(atob(base64Groups));

        console.log(strippedGroups);

        // Clear the existing groups
        groups.length = 0;

        // Populate the groups array with the loaded data
        strippedGroups.forEach(({ name, data, transform }) => {
            groups.push({ name, data, transform, result: null });
        });

        // Update the UI
        const groupsContainer = document.querySelector('.container');
        groupsContainer.innerHTML = '';  // Clear the container

        groups.forEach((group, index) => {

            const groupElement = addGroupElement();

            // Populate the fields
            const groupNameElement = groupElement.querySelector('.group-name');
            const dataElement = groupElement.querySelector('.data-text');
            const transformElement = groupElement.querySelector('.transform-text');

            groupNameElement.value = group.name;
            dataElement.value = group.data;
            transformElement.value = group.transform;

            // If both data and transform fields are filled, send an immediate API request
            if (dataElement.value && transformElement.value) {
                handleInputChange(groupElement, index, { dataText: dataElement, transformText: transformElement, refResultTextarea: groupElement.querySelector('.referenced-result-text'), groupName: groupNameElement }, true);
            }
        });
    } catch (error) {
        console.error('Error loading groups', error);
    }
}

// Call the load function when the page loads
window.addEventListener('DOMContentLoaded', loadGroups);

window.addEventListener('hashchange', () => { console.log('Hash changed!'); });
