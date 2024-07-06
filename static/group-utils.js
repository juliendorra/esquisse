export { GROUP_TYPE, INTERACTION_STATE, RESULT_DISPLAY_FORMAT, getGroupIdFromElement, getGroupElementFromId, getGroupFromName, generateGroupUUID, generateUniqueGroupName };

const GROUP_TYPE = {
    STATIC: "static",
    TEXT: "text",
    IMAGE: "image",
    BREAK: "break",
    IMPORTED_IMAGE: "imported_image",
    GRID: "grid",
    IMPORT: "import",
};

const INTERACTION_STATE = {
    OPEN: "open",
    ENTRY: "entry",
    LOCKED: "locked",
};

const RESULT_DISPLAY_FORMAT = {
    TEXT: "text",
    LIST: "list",
    HTML: "html",
};


function getGroupIdFromElement(groupElement) {
    return groupElement.dataset.id;
}

function getGroupElementFromId(groupId) {
    console.log("Getting the element for group of id ", groupId);
    return document.querySelector(`div[data-id="${groupId}"]`);
}

function getGroupFromName(name, groups) {

    // returns the first group by that name, case insensitive, ignore the rest

    for (const group of groups.values()) {
        if (group.name.toLowerCase() === name.toLowerCase()) {
            return group;
        }
    }
    console.log("Case insensitive search couldn't find a group named ", name)
    return undefined
}

function generateGroupUUID(groups) {

    return crypto.randomUUID();
}

function generateUniqueGroupName(groupType, groups) {

    let name = "";
    let unique = false;

    const names = Array.from(groups)
        .map(
            ([key, value]) => { value.name }
        );

    while (!unique) {
        name = `${groupType}-${randomInt(1, 999)}`;
        if (!names.includes(name)) {
            unique = true;
        }
    }
    return name;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}