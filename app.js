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

function addEventListenersToGroup(group, index) {

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


function addGroup() {
    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `
        <input type="text" class="group-name" placeholder="Group Name">
        <textarea class="data-text" placeholder="Data Text"></textarea>
        <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
        <textarea class="transform-text" placeholder="Transform Text"></textarea>
    `;

    const btn = document.querySelector('.add-group-btn');
    btn.parentNode.insertBefore(group, btn);

    const index = groups.length;
    groups.push({ name: '', data: '', transform: '', result: null });

    addEventListenersToGroup(group, index);
}

document.querySelector('.add-group-btn').addEventListener('click', addGroup);

addGroup();
