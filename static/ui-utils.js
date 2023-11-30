export { displayAlert };

function displayAlert(issue, action, variant = "warning") {

    const alert = document.createElement("sl-alert");

    alert.variant = variant;
    alert.duration = "3000";
    alert.closable = true;

    let alertHtml = `<sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
    <strong>${issue}</strong><br />
    ${action}`;

    alert.innerHTML = alertHtml;

    document.body.appendChild(alert);

    customElements.whenDefined('sl-alert').then(() => {
        alert.toast();
    });
}