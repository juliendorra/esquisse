export { displayAlert };

function displayAlert({ issue, action, variant = "warning", icon = "exclamation-triangle", duration = 3000 }) {

    const alert = document.createElement("sl-alert");

    alert.variant = variant;
    alert.duration = duration;
    alert.closable = true;

    let alertHtml = `
            <sl-icon slot="icon" name="${icon}"></sl-icon>
            <strong>${issue}</strong><br />
            ${action}
    `;

    alert.innerHTML = alertHtml;

    document.body.appendChild(alert);

    customElements.whenDefined('sl-alert').then(() => {
        alert.toast();
    });
}