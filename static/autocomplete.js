import { getGroupNamesForAutocomplete } from './group-management.js';
import { getCaretCoordinates } from "./ui-utils.js";

export { onInput, handleKeyNavigation };

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

function handleKeyNavigation(e) {

    console.log("[AUTOCOMPLETE] handling arrows and enter keydown");

    const dropdown = e.currentTarget.parentNode.querySelector(".autocomplete-selector");

    if (dropdown && dropdown.open && dropdown.tagName === 'SL-DROPDOWN') {

        const items = dropdown.querySelectorAll('sl-menu-item');
        const focusedItem = document.activeElement;
        let selectionIndex = Array.from(items).indexOf(focusedItem);

        if (e.key === 'ArrowDown') {
            console.log("[AUTOCOMPLETE] Arrow down");
            selectionIndex = (selectionIndex + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            selectionIndex = (selectionIndex - 1 + items.length) % items.length;
        } else if (e.key === 'Enter' && focusedItem) {
            focusedItem.click();
            return;
        }

        if (items[selectionIndex]) {
            items[selectionIndex].focus();
            // items[selectionIndex].scrollIntoView({ block: 'nearest' });
        }
    }
}

async function showDropdown(input, triggerChar, query, words) {
    const filteredWords = words.filter(word => word.toLowerCase().startsWith(query.toLowerCase()));
    let dropdown = input.parentNode.querySelector(".autocomplete-selector");

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

        menu.addEventListener("keydown", handleKeyNavigation);

        dropdown.show();

        // Position the dropdown below the cursor
        const cursorPosition = getCaretCoordinates(input, input.selectionEnd);

        const { offsetLeft: inputX, offsetTop: inputY } = input;
        cursorPosition.left = inputX + cursorPosition.left - input.scrollLeft;
        cursorPosition.top = inputY + cursorPosition.top - input.scrollTop;

        dropdown.style.position = 'absolute';
        dropdown.style.left = `${cursorPosition.left}px`;
        dropdown.style.top = `calc(${cursorPosition.top}px + 1.5em)`; // Add some offset
    } else {
        hideDropdown(input);
    }
}


function getCursorPosition(input) {
    const div = document.createElement('div');
    const span = document.createElement('span');
    const text = input.value.substring(0, input.selectionStart);

    // Copy the text styles from the textarea to the div
    const computed = window.getComputedStyle(input);

    for (let prop of computed) {
        div.style[prop] = computed[prop];
    }

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.overflow = 'hidden';
    div.style.width = input.offsetWidth + 'px';

    document.body.appendChild(div);

    div.textContent = text;
    span.textContent = text[text.length - 1] || '.';
    div.appendChild(span);

    const { offsetLeft: inputX, offsetTop: inputY } = input;
    const spanX = span.offsetLeft;
    const spanY = span.offsetTop;

    document.body.removeChild(div);

    return {
        left: inputX + spanX - input.scrollLeft,
        top: inputY + spanY - input.scrollTop
    };
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
    const dropdown = input.parentNode.querySelector(".autocomplete-selector");
    if (dropdown && dropdown.tagName === 'SL-DROPDOWN' && dropdown.hide) {
        dropdown.hide();
    }
}