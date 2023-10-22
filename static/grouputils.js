export { GROUP_TYPE, INTERACTION_STATE, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateUniqueGroupID };

const GROUP_TYPE = {
    STATIC: "static",
    TEXT: "text",
    IMAGE: "image",
    BREAK: "break",
    GRID: "grid",
    IMPORT: "import",
};

const INTERACTION_STATE = {
    OPEN: "open",
    ENTRY: "entry",
    LOCKED: "locked",
};


function getGroupIdFromElement(groupElement) {
    return groupElement.dataset.id;
}

function getGroupElementFromId(groupId) {
    console.log("Getting the element for group of id ", groupId);
    return document.querySelector(`div[data-id="${groupId}"]`);
}

function getGroupFromName(name, groups) {

    // will return the first group found by that name, ignore the rest

    for (const group of groups.values()) {
        if (group.name === name) {
            return group;
        }
    }
    console.log("couldn't find a group named ", name)
    return undefined
}

function generateUniqueGroupID(groups) {
    let name = "";
    let unique = false;
    while (!unique) {
        name = `${randomInt(1, 9999)}`;
        if (!groups.has(name)) {
            unique = true;
        }
    }
    return name;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}