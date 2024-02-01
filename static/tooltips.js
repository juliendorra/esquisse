
import tippy, { roundArrow } from "https://cdn.jsdelivr.net/npm/tippy.js@6/+esm";
// import 'https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy.min.css';

export { setTooltips, setAccessibleDescriptions };

const LANGUAGE_CODE = navigator.language.split('-')[0];

const TOOLTIPS =
{
    fr:
        [
            {
                selector: ".entry-btn",
                text: "Entrée : rend le champ de données un champ de saisie éphémère. Il sera vide lorsque l'application sera rechargée, prêt pour qu'un utilisateur le remplisse. La transformation est rendue en lecture seule et sauvegardée pour une utilisation ultérieure."
            },
            {
                selector: ".lock-btn",
                text: "Verrouiller : rend les champs de données et de transformation en lecture seule. Les deux sont sauvegardés pour une utilisation ultérieure"
            },
            {
                selector: ".list-mode-btn",
                text: "Mode liste : affiche un résultat texte semblable à une liste comme un menu déroulant, afin que vous puissiez choisir l'une des réponses"
            },
            {
                selector: ".refresh-btn",
                text: "Actualiser : demande la généreration d'un nouveau résultat"
            },
            {
                selector: ".controlnet-btn",
                text: "Mode Controlnet : la structure de l'image référencée dans le champ de données sera utilisée pour contraindre l'image. Lorsqu'il est désactivé, l'image est utilisée comme un point de départ (image vers image). Notez que seule la première image référencée est utilisée dans les deux cas."
            },
            {
                selector: ".clear-btn",
                text: "Supprime : supprime l'image importée du bloc"
            },
        ]
    ,

    en:
        [
            {
                selector: ".entry-btn",
                text: "Entry: makes the data field an ephemeral input. It'll be blank when the app is reloaded, ready for an user to fill it in. The transform is made read-only and saved for later use."
            },

            {
                selector: ".lock-btn",
                text: "Lock: makes the data and transform fields read-only. Both are saved for later use"
            },
            {
                selector: ".list-mode-btn",
                text: "List mode: turns a list-like text result into a list dropdown, so you can choose one of the answer"
            },
            {
                selector: ".refresh-btn",
                text: "Refresh: requests to generate a new result"
            },
            {
                selector: ".controlnet-btn",
                text: "Controlnet mode: the structure of the image referenced in the data field will be used to constrain the image. When off, the image is used as a starting point (image-to-image). Note that only the first image referenced is used in both case."
            },
            {
                selector: ".clear-btn",
                text: "Clear: remove the imported image from the block."
            },
        ]
}

let tooltipInstances = [];


function setAccessibleDescriptions() {

    const localizedTooltips = TOOLTIPS[LANGUAGE_CODE] ? TOOLTIPS[LANGUAGE_CODE] : TOOLTIPS["en"];

    for (const tooltip of localizedTooltips) {

        const elements = document.querySelectorAll(tooltip.selector);

        for (const element of elements) {
            element.setAttribute("aria-description", tooltip.text);
        }
    }
}

function setTooltips(tooltipsEnabled) {

    deleteTooltips();

    if (tooltipsEnabled) {

        const localizedTooltips = TOOLTIPS[LANGUAGE_CODE] ? TOOLTIPS[LANGUAGE_CODE] : TOOLTIPS["en"];

        for (const tooltip of localizedTooltips) {

            tooltipInstances.push(
                ...tippy(
                    tooltip.selector,
                    {
                        content: tooltip.text,
                        theme: 'esquisse',
                    }
                )
            );
        }
    }
}

function deleteTooltips() {

    for (const tooltip of tooltipInstances) {

        tooltip.destroy();

    }
}



