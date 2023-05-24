const groups = [];

let requestQueue = {}; // Add a requestQueue object
let lastRequestTime = 0;

const DELAY = 5000;

let hashChangedProgrammatically = false;

function displayReferencedResult(groupElement, referencedResult) {

    let groupSubElements;

    // Get the group sub elements
    if (groupElement) {
        groupSubElements = {
            dataText: groupElement.querySelector('.data-text'),
            refResultTextarea: groupElement.querySelector('.referenced-result-text'),
            transformText: groupElement.querySelector('.transform-text'),
            groupName: groupElement.querySelector('.group-name')
        };
    }

    console.log(`Displaying the group referenced result in refResultTextarea. Group ${groupSubElements.groupName.value}|data: ${groupSubElements.dataText.value}|referenced result: ${referencedResult}`)

    groupSubElements.refResultTextarea.value = referencedResult ? referencedResult : "";
    groupSubElements.refResultTextarea.style.display = 'block';
    groupSubElements.dataText.style.display = 'none';

    const index = Array.from(document.querySelectorAll('.group')).indexOf(groupElement);

    handleInputChange(groupElement, index, groupSubElements, true)
}

function checkReferenceToGroupResult(data) {
    // Check for a valid reference to a group result in data
    const groupNameMatch = data.match(/#(.+)/);
    let groupName;
    if (groupNameMatch) {
        groupName = groupNameMatch[1];
        const referencedGroup = groups.find(group => group.name === groupName);
        if (referencedGroup && referencedGroup.result) {
            data = referencedGroup.result; // Use the referenced result instead of data
        } else {
            console.log(`No group found with the name ${groupName} or the group's result is not set yet.`);
            return;
        }
    }

}

function handleInputChange(groupElement, index, groupSubElements, immediate = false) {
    console.log('handleInputChange called');

    // updating the values
    console.log(`Updating group at index: ${index}`);
    groups[index].data = groupSubElements.dataText.value;
    groups[index].transform = groupSubElements.transformText.value;

    let dataToSend = groups[index].data;
    const transformValue = groups[index].transform;

    // Check for a valid reference to a group result in data
    const groupNameMatch = dataToSend.match(/#(.+)/);
    let groupName;
    if (groupNameMatch) {
        groupName = groupNameMatch[1];
        const referencedGroup = groups.find(group => group.name === groupName);
        if (referencedGroup && referencedGroup.result) {
            dataToSend = referencedGroup.result; // Use the referenced result instead of data
        } else {
            console.log(`No group found with the name ${groupName} or the group's result is not set yet.`);
            return;
        }
    }

    if (dataToSend && transformValue) {
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
                handleInputChange(groupElement, index, groupSubElements, true);
            }, timeout);



            return;
        }

        lastRequestTime = currentTime;

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: dataToSend,
                transform: transformValue
            })
        };

        if (groups[index].type === 'image') {

            console.log(`Sending image request ${dataToSend} ||| ${transformValue}`);

            fetch('/stability', fetchOptions)
                .then(response => response.arrayBuffer())
                .then((resultBuffer) => {

                    console.log(`Received image result buffer`);

                    const blob = new Blob([resultBuffer]);
                    const reader = new FileReader();

                    reader.onloadend = function () {
                        const base64data = reader.result;
                        // Now base64data can be used as a source for an img tag for instance
                        let resultImage = groupElement.querySelector('.result');
                        if (!resultImage) {
                            resultImage = document.createElement('img');
                            resultImage.className = 'result';
                            groupElement.appendChild(resultImage);
                        }

                        resultImage.src = base64data;
                    }

                    reader.readAsDataURL(blob);

                    delete requestQueue[index];
                });
        } else {

            console.log(`Sending text request ${dataToSend} ||| ${transformValue}`);

            fetch('/chatgpt', fetchOptions)
                .then(response => response.json())
                .then((result) => {

                    console.log(`Received result: ${result}`);

                    groups[index].result = result;

                    let resultParagraph = groupElement.querySelector('.result');

                    if (!resultParagraph) {
                        resultParagraph = document.createElement('p');
                        resultParagraph.className = 'result';
                        groupElement.appendChild(resultParagraph);
                    }

                    resultParagraph.textContent = groups[index].result;

                    // Update all data textareas with the new result
                    document.querySelectorAll('.group').forEach((group, idx) => {

                        const groupElements = {
                            dataText: group.querySelector('.data-text'),
                        };

                        const groupNameMatch = groupElements.dataText.value.match(/#(.+)/);

                        if (groupNameMatch && groupNameMatch[1] === groups[index].name) {
                            displayReferencedResult(group, result);

                        }
                    });


                    delete requestQueue[index]; // Remove the request from the queue after it's complete
                });
        }
    }
}

function addEventListenersToGroup(groupElement) {

    const index = Array.from(document.querySelectorAll('.group')).indexOf(groupElement);

    console.log("adding listener to group index:", index)

    const groupSubElements = {
        dataText: groupElement.querySelector('.data-text'),
        refResultTextarea: groupElement.querySelector('.referenced-result-text'),
        transformText: groupElement.querySelector('.transform-text'),
        groupName: groupElement.querySelector('.group-name')
    };

    groupElement.querySelector('.delete-btn').addEventListener('click', () => deleteGroup(groupElement, index));

    // group.querySelectorAll('.data-text, .transform-text').forEach(input => {
    //     input.addEventListener('input', () => handleInputChange(group, index, groupSubElements, false));
    // });

    groupElement.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('change', () => handleInputChange(groupElement, index, groupSubElements, true));
    });


    groupElement.querySelector('.group-name').addEventListener('input', (event) => {
        groups[index].name = event.target.value;
        console.log(`Group ${index} name now:${groups[index].name})`)
    });

    // Call the persist function when a group's name, data or transform changes
    groupSubElements.groupName.addEventListener('change', persistGroups);
    groupSubElements.dataText.addEventListener('change', persistGroups);
    groupSubElements.transformText.addEventListener('change', persistGroups);

    const dataTextarea = groupSubElements.dataText;
    const refResultTextarea = groupSubElements.refResultTextarea;

    refResultTextarea.style.display = 'none';

    dataTextarea.addEventListener('blur', () => {

        // Check for a valid reference to a group result in data

        const groupNameMatch = groupSubElements.dataText.value.match(/#(.+)/);

        let groupName;
        if (groupNameMatch) {
            groupName = groupNameMatch[1];
            const referencedGroup = groups.find(group => group.name === groupName);
            if (referencedGroup && referencedGroup.result) {
                displayReferencedResult(groupElement, referencedGroup.result)
            } else {
                console.log(`When trying to show reference: No group found with the name ${groupName} or the group's result is not set yet.`);
                return;
            }
        }
    }
    );


    refResultTextarea.addEventListener('focus', () => {
        refResultTextarea.style.display = 'none';
        dataTextarea.style.display = 'block';
        dataTextarea.focus();
    });

    dataTextarea.addEventListener('focus', () => {
        refResultTextarea.style.display = 'none';
    });

}


function addGroupElement(isImageGroup = false) {
    const group = document.createElement('div');

    if (isImageGroup) {
        group.className = 'group image';
        group.innerHTML = `
            <div class="group-header">
                <small>🖍️</small>
                <button class="delete-btn">&#x2715;</button>
                
            </div>
            <input type="text" class="group-name" placeholder="Name of this Block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
        `;
    } else {
        group.className = 'group text';
        group.innerHTML = `
            <div class="group-header">
                <small>📝 </small>
                <button class="delete-btn">&#x2715</button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
        `;
    }

    const container = document.querySelector('.container');
    container.appendChild(group);

    addEventListenersToGroup(group, isImageGroup);
    return group;
}

function addGroupElementAndPushGroup(isImageGroup = false) {

    addGroupElement(isImageGroup);

    const type = isImageGroup ? "image" : "text"

    groups.push({ name: '', data: '', transform: '', result: null, type: type });

}

function deleteGroup(groupElement, index) {
    // Remove the group from the HTML
    groupElement.remove();

    const name = groups[index].name;

    // Delete the group entry in the groups array
    groups.splice(index, 1);

    // Update indices and event listeners for all groups
    document.querySelectorAll('.group').forEach((group, idx) => {
        group.querySelector('.delete-btn').addEventListener('click', () => deleteGroup(group, idx));

        // If this group references the deleted group, remove the reference
        const dataText = group.querySelector('.data-text').value;
        const referencedGroup = dataText.match(/#(.+)/);

        if (referencedGroup && referencedGroup[1] === name) {
            group.querySelector('.referenced-result-text').value = "";
            group.querySelector('.referenced-result-text').style.display = 'none';
            group.querySelector('.data-text').style.display = 'block';
        }
    });

    // Update the URL with the new groups
    persistGroups();
}


function persistGroups() {

    // Omit the results and only include {name, data, transform} for text groups
    // For image groups, we omit the result and the image
    const strippedGroups = groups.map(({ name, data, transform, type }) => ({ name, data, transform, type }));

    // Convert to JSON and then to Base64
    const base64Groups = btoa(JSON.stringify(strippedGroups));

    console.log(groups, base64Groups)

    // Update the URL with the encoded groups
    hashChangedProgrammatically = true;
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

        const groupsContainer = document.querySelector('.container');
        groupsContainer.innerHTML = '';  // Clear the container

        // Populate the groups array with the loaded data
        strippedGroups.forEach(({ name, data, transform, type }, index) => {
            groups.push({ name, data, transform, type, result: null });

            const groupElement = type === "image" ? addGroupElement(true) : addGroupElement(false);

            // Populate the fields
            const groupNameElement = groupElement.querySelector('.group-name');
            const dataElement = groupElement.querySelector('.data-text');
            const transformElement = groupElement.querySelector('.transform-text');

            groupNameElement.value = name;
            dataElement.value = data;
            transformElement.value = transform;

            // If both data and transform fields are filled, send an immediate API request
            if (dataElement.value && transformElement.value) {
                handleInputChange(groupElement, index, { dataText: dataElement, transformText: transformElement, refResultTextarea: groupElement.querySelector('.referenced-result-text'), groupName: groupNameElement }, true);
            }
        });
    } catch (error) {
        console.error('Error loading groups', error);
    }
}


function init() {

    loadGroups()

    document.querySelector('.add-group-btn').addEventListener('click', () => addGroupElementAndPushGroup(false));

    document.querySelector('.add-img-group-btn').addEventListener('click', () => addGroupElementAndPushGroup(true));
}


// Call the init function when the page loads

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init()
}

window.addEventListener('hashchange', () => {

    console.log('Hash changed! Programmatically? ', hashChangedProgrammatically);

    if (!hashChangedProgrammatically) {

        loadGroups()

    }

    hashChangedProgrammatically = false;
}
);
