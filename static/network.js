import { displayAlert } from "./ui-utils.js";

export { fetchWithCheck };

const displayDisconnectAlert = getDisconnectAlertHandler();

async function fetchWithCheck(input, init) {

    checkServerReachability();

    return fetch(input, init);
}

async function checkServerReachability() {
    if (!window.navigator.onLine) return false

    // we request our own origin
    const url = new URL(window.location.origin)

    // random value to prevent cached responses
    url.searchParams.set('random', getRandomString())

    // Using HEAD because we don't care about the result, just that we get a response
    // https://dev.to/maxmonteil/is-your-app-online-here-s-how-to-reliably-know-in-just-10-lines-of-js-guide-3in7
    try {
        const response = await fetch(
            url.toString(),
            { method: 'HEAD' },
        )
        return response.ok;
    } catch {
        console.log("[NETWORK] Unable to reach server, the network might be disconnected")
        displayDisconnectAlert();
        return false;
    }
}

function getDisconnectAlertHandler() {

    let disconnectAlert;

    return async function () {

        if (!disconnectAlert) {
            disconnectAlert = await displayAlert(
                {
                    issue: "No network connection",
                    action: "Try to reconnect",
                    variant: "warning",
                    icon: "wifi-off",
                    duration: 3000
                }
            )
        }
        else {
            disconnectAlert.toast();
        }
    }
}

// Utils

function getRandomString() {
    return Math.random().toString(36).substring(2, 15)
}