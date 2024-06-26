import { getGroupNamesForAutocomplete } from './group-management.js';

export { onInput, onKeyDown };

function onInput(e) {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const value = input.value.slice(0, cursorPos);
    const triggerCharIndex = Math.max(value.lastIndexOf('#'), value.lastIndexOf('['));

    if (triggerCharIndex >= 0) {
        const triggerChar = value[triggerCharIndex];
        const query = value.slice(triggerCharIndex + 1);
        const currentGroupId = input.closest('.group').dataset.id;
        const groupNames = getGroupNamesForAutocomplete(currentGroupId);

        showDropdown(input, triggerChar, query, groupNames);
    } else {
        hideDropdown(input);
    }
}

function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        const dropdown = e.target.nextElementSibling;
        if (dropdown && dropdown.open && dropdown.tagName === 'SL-DROPDOWN') {
            e.preventDefault();
            handleKeyNavigation(e, dropdown);
        }
    }
}

function handleKeyNavigation(e, dropdown) {
    const items = dropdown.querySelectorAll('sl-menu-item');
    const activeItem = dropdown.querySelector('sl-menu-item[active]');
    let newIndex = Array.from(items).indexOf(activeItem);

    if (e.key === 'ArrowDown') {
        newIndex = (newIndex + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
        newIndex = (newIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Enter' && activeItem) {
        activeItem.click();
    }

    items.forEach(item => item.removeAttribute('active'));
    if (items[newIndex]) {
        items[newIndex].setAttribute('active', '');
        items[newIndex].scrollIntoView({ block: 'nearest' });
    }
}

async function showDropdown(input, triggerChar, query, words) {
    const filteredWords = words.filter(word => word.toLowerCase().startsWith(query.toLowerCase()));
    let dropdown = input.nextElementSibling;

    if (!dropdown || dropdown.tagName !== 'SL-DROPDOWN') {
        dropdown = document.createElement('sl-dropdown');
        dropdown.classList.add("autocomplete-selector");
        dropdown.innerHTML = '<sl-menu></sl-menu>';
        input.insertAdjacentElement('afterend', dropdown);
    }

    const menu = dropdown.querySelector('sl-menu');
    menu.innerHTML = '';

    if (filteredWords.length > 0) {
        filteredWords.forEach(word => {
            const item = document.createElement('sl-menu-item');
            item.textContent = word;
            item.addEventListener('click', () => selectWord(input, triggerChar, word));
            menu.appendChild(item);
        });

        await customElements.whenDefined('sl-dropdown');
        dropdown.show();
    } else {
        dropdown.hide();
    }
}

function selectWord(input, triggerChar, word) {
    const cursorPos = input.selectionStart;
    const value = input.value;
    const triggerCharIndex = Math.max(value.lastIndexOf('#', cursorPos - 1), value.lastIndexOf('[', cursorPos - 1));

    let newValue;
    if (triggerChar === '#' && /\s/.test(word)) {
        // If the triggerChar is '#' and the word contains whitespace, replace with '[]'
        newValue = `${value.slice(0, triggerCharIndex)}[${word}] ${value.slice(cursorPos)}`;
    } else if (triggerChar === '#') {
        // If the triggerChar is '#' and the word does not contain whitespace, use the original format
        newValue = `${value.slice(0, triggerCharIndex + 1)}${word} ${value.slice(cursorPos)}`;
    } else {
        // If the triggerChar is '[', use the original format
        newValue = `${value.slice(0, triggerCharIndex + 1)}${word}] ${value.slice(cursorPos)}`;
    }

    input.value = newValue;
    input.setSelectionRange(triggerCharIndex + word.length + (triggerChar === '[' ? 3 : 2), triggerCharIndex + word.length + (triggerChar === '[' ? 3 : 2));
    input.focus();

    hideDropdown(input);
}

function hideDropdown(input) {
    const dropdown = input.nextElementSibling;
    if (dropdown && dropdown.tagName === 'SL-DROPDOWN') {
        dropdown.hide();
    }
}
