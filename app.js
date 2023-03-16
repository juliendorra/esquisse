import { callGPT } from './gpt.js';

const groups = [];

function updateDataTextarea(dataTextarea, refResultTextarea, groupName) {
    const group = groups.find(group => group.name === groupName);
    if (!group) {
        dataTextarea.style.display = 'none';
        refResultTextarea.style.display = 'block';
        refResultTextarea.classList.add('error');
        refResultTextarea.value = 'Error: Group not found.';
        return;
    }

    refResultTextarea.classList.remove('error');
    refResultTextarea.value = group.result ? group.result : `#${groupName}`;
}

function addEventListenersToGroup(group, index) {
    let timer = null;
    let lastRequestTime = 0;
    let latestRequestId = 0;

    function handleInputChange() {
        console.log('handleInputChange called');
        clearTimeout(timer);
        const currentTime = Date.now();

        if (currentTime - lastRequestTime < 5000) {
            const timeout = 5000 - (currentTime - lastRequestTime)
            console.log(`Waiting for ${timeout / 1000} seconds`);
            timer = setTimeout(handleInputChange, timeout);
            return;
        }

        lastRequestTime = currentTime;
        groups[index].data = group.querySelector('.data-text').value;
        groups[index].transform = group.querySelector('.transform-text').value;

        const dataValue = groups[index].data;
        const transformValue = groups[index].transform;

        if (dataValue && transformValue) {
            latestRequestId++;
            const requestId = latestRequestId;
            console.log(`Sending request ${requestId} with ${dataValue} and ${transformValue}`);

            callGPT(dataValue, transformValue).then((result) => {

                console.log(`Received result for request ${requestId}`);

                if (requestId !== latestRequestId) return;

                groups[index].result = result;

                let resultParagraph = group.querySelector('.result');

                if (!resultParagraph) {
                    resultParagraph = document.createElement('p');
                    resultParagraph.className = 'result';
                    group.appendChild(resultParagraph);
                }

                resultParagraph.textContent = result;

                // Update all data textareas with the new result
                document.querySelectorAll('.data-text').forEach(dataTextarea => {
                    const groupNameMatch = dataTextarea.value.match(/#(.+)/);
                    if (groupNameMatch && groupNameMatch[1] === groups[index].name) {
                        const refResultTextarea = dataTextarea.nextElementSibling;
                        updateDataTextarea(dataTextarea, refResultTextarea, groupNameMatch[1]);
                    }
                });
            });
        }
    }

    group.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('input', (event) => {
            if (input.classList.contains('data-text')) {
                groups[index].data = event.target.value;
            } else {
                groups[index].transform = event.target.value;
            }
            handleInputChange();
        });
    });

    group.querySelector('.group-name').addEventListener('input', (event) => {
        groups[index].name = event.target.value;
        console.log(`Group ${index} name now:${groups[index].name})`)
    });

    const dataTextarea = group.querySelector('.data-text');
    const refResultTextarea = group.querySelector('.referenced-result-text');
    refResultTextarea.style.display = 'none';

    dataTextarea.addEventListener('blur', () => {
        const groupNameMatch = dataTextarea.value.match(/#(.+)/);

        if (groupNameMatch) {
            const groupName = groupNameMatch[1];
            const referencedGroup = groups.find(group => group.name === groupName);
            if (referencedGroup && referencedGroup.result) {
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

    refResultTextarea.addEventListener('blur', () => {
        const groupNameMatch = dataTextarea.value.match(/#(.+)/);
        if (groupNameMatch) {
            updateDataTextarea(dataTextarea, refResultTextarea, groupNameMatch[1]);
        }
    });

    refResultTextarea.addEventListener('focus', () => {
        if (refResultTextarea.classList.contains('error')) {
            refResultTextarea.style.display = 'none';
            refResultTextarea.style.value = null;

            dataTextarea.style.display = 'block';
            dataTextarea.focus()
        }
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
