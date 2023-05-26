const groups = [];

let requestQueue = {}; // Add a requestQueue object

const DELAY = 5000;

let hashChangedProgrammatically = false;

// Call the init function when the page loads

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init()
}

function init() {

    loadGroups()

    window.addEventListener('hashchange', () => {

        console.log('Hash changed! Programmatically? ', hashChangedProgrammatically);

        if (!hashChangedProgrammatically) {

            loadGroups()

        }

        hashChangedProgrammatically = false;
    }
    );


    document.querySelector('.add-group-btn').addEventListener('click', () => addGroupElementAndPushGroup(false));

    document.querySelector('.add-img-group-btn').addEventListener('click', () => addGroupElementAndPushGroup(true));
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

            // data and transform will be adde by handleInputChange
            groups.push({ name, data: null, transform: null, type, result: null, lastRequestTime: 0 });

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

                handleInputChange(groupElement, index, true, false);
            }
        });
    } catch (error) {
        console.error('Error loading groups', error);
    }
}

function persistGroups() {

    // Omit the results and only include {name, data, transform} for text groups
    // For image groups, we omit the result and the image
    const strippedGroups = groups.map(({ name, data, transform, type }) => ({ name, data, transform, type }));

    // Convert to JSON and then to Base64
    const base64Groups = btoa(JSON.stringify(strippedGroups));

    // console.log(groups, base64Groups)

    // Update the URL with the encoded groups
    hashChangedProgrammatically = true;
    window.location.hash = base64Groups;
}

function addGroupElement(isImageGroup = false) {
    const group = document.createElement('div');

    if (isImageGroup) {
        group.className = 'group image';
        group.innerHTML = `
            <div class="group-header">
                <small>🎨</small>
                <button class="delete-btn">&#x2715;</button>
                
            </div>
            <input type="text" class="group-name" placeholder="Name of this Block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
            <div class="function-buttons-container">
            <button class="entry-btn">📥</button>
            <button class="lock-btn">🔒</button>
            <button class="refresh-btn">⟳</button>
            </div>
        `;
    } else {
        group.className = 'group text';
        group.innerHTML = `
            <div class="group-header">
                <small>📝</small>
                <button class="delete-btn">&#x2715</button>
            </div>
            <input type="text" class="group-name" placeholder="Name of this block">
            <textarea class="data-text" placeholder="Data you want to use or #name reference to another block result"></textarea>
            <textarea class="referenced-result-text" placeholder="Referenced Result" readonly></textarea>
            <textarea class="transform-text" placeholder="Instructions to Transform data into result"></textarea>
            <div class="function-buttons-container">
            <button class="entry-btn">📥</button>
            <button class="lock-btn">🔒</button>
            <button class="refresh-btn">⟳</button>
            </div>
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

function addEventListenersToGroup(groupElement) {

    const index = Array.from(document.querySelectorAll('.group')).indexOf(groupElement);

    const groupSubElements = {
        groupName: groupElement.querySelector('.group-name'),
        dataText: groupElement.querySelector('.data-text'),
        refResultTextarea: groupElement.querySelector('.referenced-result-text'),
        transformText: groupElement.querySelector('.transform-text'),
    };

    console.log("adding listener to group index:", index)

    groupElement.querySelector('.delete-btn').addEventListener('click', () => deleteGroup(groupElement, index));

    groupElement.querySelector('.lock-btn').addEventListener('click', () => {
        const isReadonly = groupSubElements.groupName.hasAttribute('readonly');
        if (isReadonly) {
            groupSubElements.groupName.removeAttribute('readonly');
            groupSubElements.dataText.removeAttribute('readonly');
            groupSubElements.transformText.removeAttribute('readonly');
        } else {
            groupSubElements.groupName.setAttribute('readonly', 'readonly');
            groupSubElements.dataText.setAttribute('readonly', 'readonly');
            groupSubElements.transformText.setAttribute('readonly', 'readonly');
        }
    });

    groupElement.querySelector('.entry-btn').addEventListener('click', () => {
        const isReadonly = groupSubElements.groupName.hasAttribute('readonly');
        if (isReadonly) {
            groupSubElements.groupName.removeAttribute('readonly');
            groupSubElements.transformText.removeAttribute('readonly');
        } else {
            groupSubElements.groupName.setAttribute('readonly', 'readonly');
            groupSubElements.transformText.setAttribute('readonly', 'readonly');
        }
    });


    // Initially hide the refresh button
    groupElement.querySelector('.refresh-btn').style.display = 'none';
    groupElement.querySelector('.refresh-btn').addEventListener('click', () => handleInputChange(groupElement, index, true, true));

    // group.querySelectorAll('.data-text, .transform-text').forEach(input => {
    //     input.addEventListener('input', () => handleInputChange(group, index, false, false));
    // });

    groupElement.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('change', () => handleInputChange(groupElement, index, true, false));
    });

    // groupElement.querySelector('.group-name').addEventListener('input', (event) => {
    //     groups[index].name = event.currentTarget.value;
    //     console.log(`Group ${index} name now:${groups[index].name})`)
    // });


    // Call the persist function when a group's name, data or transform changes
    groupSubElements.groupName.addEventListener('change',

        (event) => {
            event.currentTarget.value = event.currentTarget.value.trim()
            groups[index].name = event.currentTarget.value;
            console.log(`Group ${index} name now:${groups[index].name}`)
            persistGroups();
        }

    );

    groupSubElements.dataText.addEventListener('change', persistGroups);
    groupSubElements.transformText.addEventListener('change', persistGroups);

    const dataTextarea = groupSubElements.dataText;
    const refResultTextarea = groupSubElements.refResultTextarea;

    refResultTextarea.style.display = 'none';

    dataTextarea.addEventListener('blur', () => {

        let { hasHashReferences, isMatchingExistingGroups, referencedResults, combinedResults } = getReferencedResults(groupSubElements.dataText.value, groups);
        if (referencedResults.length > 0) {
            console.log(referencedResults)
            displayReferencedResult(groupElement, combinedResults);
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

async function handleInputChange(groupElement, index, immediate = false, isRefresh = false) {
    console.log('handleInputChange called');

    let groupSubElements = {
        dataText: groupElement.querySelector('.data-text'),
        refResultTextarea: groupElement.querySelector('.referenced-result-text'),
        transformText: groupElement.querySelector('.transform-text'),
        groupName: groupElement.querySelector('.group-name')
    };

    let currentData = groupSubElements.dataText.value;
    const lastTransformValue = groupSubElements.transformText.value;

    let referencedResultsChanged = false;

    let { hasHashReferences, isMatchingExistingGroups, referencedResults, combinedResults } = getReferencedResults(groupSubElements.dataText.value, groups);

    if (referencedResults.length > 0) {
        currentData = displayReferencedResult(groupElement, combinedResults);

        if (currentData !== groups[index].referencedresults) {
            referencedResultsChanged = true;
        }

        groups[index].referencedresults = currentData;
    }

    // return early if values didn't change

    if (!isRefresh && groups[index].data === groupSubElements.dataText.value
        && groups[index].transform == groupSubElements.transformText.value
        && !referencedResultsChanged) {

        console.log("no value changed, aborting input change");

        return;
    }

    // updating the values in the groups structure
    console.log(`Updating group at index: ${index}`);
    groups[index].data = groupSubElements.dataText.value;
    groups[index].transform = groupSubElements.transformText.value;

    const dataReadyToSend = !hasHashReferences && currentData || referencedResults.length > 0;

    if (dataReadyToSend && lastTransformValue) {
        clearTimeout(requestQueue[index]);

        const currentTime = Date.now();
        if (currentTime - groups[index].lastRequestTime < DELAY && !immediate) {
            const timeout = DELAY - (currentTime - groups[index].lastRequestTime);
            console.log(`Waiting for ${timeout / 1000} seconds`);

            // clearing the previous timeout
            if (requestQueue[index]) {
                clearTimeout(requestQueue[index]);
            }

            requestQueue[index] = setTimeout(() => {
                handleInputChange(groupElement, index, true, isRefresh);
            }, timeout);

            return;
        }

        groups[index].lastRequestTime = currentTime;


        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: currentData,
                transform: lastTransformValue
            })
        };

        if (groups[index].type === 'image') {

            console.log(`[REQUEST] image ||| ${currentData} ||| ${lastTransformValue}`);

            try {
                const response = await fetch('/stability', fetchOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const resultBuffer = await response.arrayBuffer();

                console.log(`Received image result buffer`);

                const blob = new Blob([resultBuffer]);
                const reader = new FileReader();

                return new Promise((resolve, reject) => {

                    // what to do when the blob is read?
                    reader.onloadend = async function () {

                        const base64data = reader.result;
                        // Now base64data can be used as a source for an img tag for instance
                        let resultImage = groupElement.querySelector('.result');
                        if (!resultImage) {
                            resultImage = document.createElement('img');
                            resultImage.className = 'result';
                            groupElement.appendChild(resultImage);
                        }

                        resultImage.src = base64data;

                        // Show the refresh button now that a result is displayed
                        groupElement.querySelector('.refresh-btn').style.display = 'block';

                        delete requestQueue[index];

                        resolve(base64data);
                    }

                    reader.onerror = reject;

                    // start reading the blob
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error(`Fetch failed: ${error}`);
                // Here we should insert an UI element that allows the user to retry
            }

        } else {

            console.log(`[REQUEST] text ||| ${currentData} ||| ${lastTransformValue}`);

            try {
                const response = await fetch('/chatgpt', fetchOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                console.log(`Received result: ${result}`);

                groups[index].result = result;

                let resultParagraph = groupElement.querySelector('.result');
                if (!resultParagraph) {
                    resultParagraph = document.createElement('p');
                    resultParagraph.className = 'result';
                    groupElement.appendChild(resultParagraph);
                }

                resultParagraph.textContent = groups[index].result;

                // Show the refresh button now that a result is displayed
                groupElement.querySelector('.refresh-btn').style.display = 'block';

                // Update all data textareas with the new result
                document.querySelectorAll('.group').forEach((groupElementIncludingReference, idx) => {

                    const groupSubElements = {
                        dataText: groupElementIncludingReference.querySelector('.data-text'),
                    };

                    let { hasHashReferences, isMatchingExistingGroups, referencedResults, combinedResults } = getReferencedResults(groupSubElements.dataText.value, groups);

                    if (referencedResults.length > 0) {

                        displayReferencedResult(groupElementIncludingReference, combinedResults);

                        handleInputChange(groupElementIncludingReference, idx, true);
                    }
                });

                delete requestQueue[index]; // Remove the request from the queue after it's complete
            } catch (error) {
                console.error(`Fetch failed: ${error}`);
                // Here we should insert an UI element that allows the user to retry
            }

        }
    }
}

function getReferencedResults(dataText, groups) {
    const groupNameMatches = dataText.match(/#(\w+)/g);

    let hasHashReferences = false;
    let isMatchingExistingGroups = false;
    let referencedResults = [];
    let combinedResults = dataText;

    if (groupNameMatches && groupNameMatches.length > 0) {
        hasHashReferences = true;

        const groupNames = groupNameMatches.map(match => match.slice(1)); // Remove '#' from each match

        referencedResults = groupNames.map(name => {
            const referencedGroup = groups.find(group => group.name === name);

            if (!referencedGroup) {
                console.log(`When trying to show reference: No group found with the name ${name}`);
                return null;
            }

            isMatchingExistingGroups = true; // One matching group found.

            if (!referencedGroup.result) {
                console.log(`When trying to show reference: The group's result is not set yet for group ${name}.`);
                return null;
            }

            // Replace the reference in the dataText with the group name and result
            combinedResults = combinedResults.replace(`#${name}`, `\n${name}: ${referencedGroup.result}\n`);

            return { name: name, result: referencedGroup.result };
        }).filter(result => result); // Filter out any null results
    }

    return { hasHashReferences, isMatchingExistingGroups, referencedResults, combinedResults };
}

function displayReferencedResult(groupElement, combinedResults) {

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

    console.log(`Displaying the group referenced result in refResultTextarea. Group ${groupSubElements.groupName.value}|data: ${groupSubElements.dataText.value}|referenced result: ${combinedResults}`)

    groupSubElements.refResultTextarea.value = combinedResults ? combinedResults : "";
    groupSubElements.refResultTextarea.style.display = 'block';
    groupSubElements.dataText.style.display = 'none';

    return combinedResults;
}

