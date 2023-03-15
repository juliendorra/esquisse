import { callGPT } from './gpt.js';

function addEventListenersToGroup(group) {
    let timer = null;

    group.querySelectorAll('.data-text, .transform-text').forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(timer);

            const dataInput = group.querySelector('.data-text');
            const transformInput = group.querySelector('.transform-text');

            if (dataInput.value && transformInput.value) {
                timer = setTimeout(async () => {
                    const result = await callGPT(dataInput.value, transformInput.value);
                    let resultParagraph = group.querySelector('.result');

                    if (!resultParagraph) {
                        resultParagraph = document.createElement('p');
                        resultParagraph.className = 'result';
                        group.appendChild(resultParagraph);
                    }

                    resultParagraph.textContent = result;
                }, 3000);
            }
        });
    });
}

document.querySelector('.add-group-btn').addEventListener('click', function () {
    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `
        <input type="text" class="group-name" placeholder="Group Name">
        <textarea class="data-text" placeholder="Data Text"></textarea>
        <textarea class="transform-text" placeholder="Transform Text"></textarea>
    `;

    const btn = document.querySelector('.add-group-btn');
    btn.parentNode.insertBefore(group, btn);

    addEventListenersToGroup(group);
});

addEventListenersToGroup(document.querySelector('.group'));
