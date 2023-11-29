import Validator from 'https://esm.run/jsonschema';
import Papa from 'https://esm.run/papaparse';

document.getElementById('listUsersBtn').addEventListener('click', async () => {
    const response = await fetch('/list-users');
    const users = await response.json();
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    users.forEach(user => {
        let listItem = document.createElement('li');
        listItem.textContent = `${user.value.username}, ${user.value.userdisplayname}, ${user.value.created}`;
        usersList.appendChild(listItem);
    });
});

const userSchema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "username": { "type": "string" },
            "userdisplayname": { "type": "string" },
            "password": { "type": "string" }
        },
        "required": ["username", "userdisplayname", "password"],
        "additionalProperties": false
    }
};

document.getElementById('bulkCreateBtn').addEventListener('click', async () => {

    let data = document.getElementById('bulkCreateInput').value;

    // Check if data is CSV and convert if necessary
    if (isCSV(data)) {
        try {
            data = convertCsvToObject(data);
        }
        catch {
            alert('Impossible to convert CSV to data');
            return;
        }
    } else {
        try {
            data = JSON.parse(data);
        } catch (e) {
            alert('Invalid JSON format');
            return;
        }
    }

    // Validate the JSON against the schema
    const validator = new Validator.Validator();
    const validationResult = validator.validate(data, userSchema);
    if (!validationResult.valid) {
        alert('Data does not match the required schema');
        return;
    }

    const response = await fetch('/bulk-create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const responseData = await response.json();
    displayUserResults(responseData);
    const downloadButton = document.getElementById('downloadResponseBtn');
    downloadButton.style.display = 'block';
    downloadButton.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(responseData))}`;
    downloadButton.download = 'response.json';
});

function isCSV(text) {
    const result = Papa.parse(text, {
        dynamicTyping: true,
        skipEmptyLines: true,
        comments: true
    });

    // Check if the parsing was successful and the data is non-trivial
    return result.data.length > 0 && result.errors.length === 0;
}

function convertCsvToObject(csv) {
    const lines = csv.split('\n');
    const result = [];
    const headers = lines[0].split(',').map(header => header.trim());

    for (let i = 1; i < lines.length; i++) {
        let obj = {};
        const currentline = lines[i].split(',');

        headers.forEach((header, j) => {
            obj[header] = currentline[j].trim();
        });

        result.push(obj);
    }
    return result;
}

function displayUserResults(data) {
    const usersCreatedList = document.getElementById('usersCreatedList');
    const usersRejectedList = document.getElementById('usersRejectedList');
    const usersCreatedTitle = document.getElementById('usersCreatedTitle');
    const usersRejectedTitle = document.getElementById('usersRejectedTitle');

    usersCreatedList.innerHTML = '';
    usersRejectedList.innerHTML = '';

    if (data.userscreated.length > 0) {
        usersCreatedTitle.style.display = 'block';
        data.userscreated.forEach(user => {
            let listItem = document.createElement('li');
            listItem.textContent = `${user.username}, ${user.userdisplayname}`;
            usersCreatedList.appendChild(listItem);
        });
    }

    if (data.usersrejected.length > 0) {
        usersRejectedTitle.style.display = 'block';
        data.usersrejected.forEach(user => {
            let listItem = document.createElement('li');
            listItem.textContent = `${user.username}, ${user.userdisplayname}`;
            usersRejectedList.appendChild(listItem);
        });
    }
}

