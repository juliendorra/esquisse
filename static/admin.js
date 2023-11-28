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

document.getElementById('bulkCreateBtn').addEventListener('click', async () => {
    const data = document.getElementById('bulkCreateInput').value;
    const response = await fetch('/bulk-create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data
    });
    const responseData = await response.json();
    const downloadButton = document.getElementById('downloadResponseBtn');
    downloadButton.style.display = 'block';
    downloadButton.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(responseData))}`;
    downloadButton.download = 'response.json';
});

