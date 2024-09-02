
import tippy, { roundArrow } from "https://cdn.jsdelivr.net/npm/tippy.js@6/+esm";
// import 'https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy.min.css';

export { setTooltips, setAccessibleDescriptions };

const LANGUAGE_CODE = navigator.language.split('-')[0];

const TOOLTIPS =
{
    fr:
        [
            {
                selector: ".inline-reference-text.not-ready",
                text: "Référence pas encore disponible. Le bloc mentionné n'a pas de résultat à afficher."
            },
            {
                selector: ".inline-reference-text.not-valid",
                text: "Référence invalide. Le bloc mentionné n'existe pas !"
            },
            {
                selector: ".entry-btn",
                text: "Mode bloc de saisie : une fois ce bouton activé, le champ de données devient un champ de saisie éphémère. Il sera vide lorsque l'application sera rechargée, prêt pour qu'un utilisateur le remplisse. Astuce : utilisez un bloc Static Text dédié comme bloc de saisie pour vos utilisateurs."
            },
            {
                selector: ".html-mode-btn",
                text: "Mode HTML : C'est le mode par défaut. Affiche le résultat en tant que text HTML riche avec titres, listes, formats de texte, semblable à une page web, si ces éléments existent dans le résultat."
            },
            {
                selector: ".text-mode-btn",
                text: "Mode texte : affiche le résultat au format texte brut. Cela permet par exemple de visualiser et copier le code brut renvoyé par un bloc Text Generator"
            },
            {
                selector: ".list-mode-btn",
                text: `Mode liste : affiche un résultat texte semblable à une liste comme un menu déroulant, afin que vous puissiez choisir l'une des réponses. Fonctionne avec les listes à puces et tirets, listes numérotés, listes à virgules… Demandez le bon format lorsque vous générez du texte avec un bloc Text Generator. Vous pouvez aussi crées des listes de références manuellement dans un bloc Static Text<br /><br />
                Formats reconnus:<br /><br />
                - item<br /><br />
                * item<br /><br />
                1. item<br /><br />
                1/ item<br /><br />
                "item1", "item2", and "item3"<br /><br /
                >item1, item2, item3`
            },
            {
                selector: ".refresh-btn",
                text: "Actualiser : demande la généreration d'un nouveau résultat."
            },
            {
                selector: ".image-to-image-btn",
                text: "Mode image-to-image : l'image entière référencée dans le champ de données est utilisée comme un point de départ. Notez que seule la première image référencée est utilisée."
            },
            {
                selector: ".controlnet-btn",
                text: "Mode Controlnet : la structure de l'image référencée dans le champ de données sera utilisée pour contraindre l'image. Notez que seule la première image référencée est utilisée."
            },
            {
                selector: ".clear-btn",
                text: "Supprime : supprime l'image importée du bloc."
            },
            {
                selector: ".group.image > .download-btn",
                text: "Télécharge : Télécharge l'image générée par ce bloc."
            },
            {
                selector: ".group:first-child > .group-name",
                text: "Nom du premier bloc : Le nom du premier bloc (en haut à gauche) est automatiquement utilisé comme nom de votre application.<br /><br />Renommer vos blocs facilitera également leur référencement et l'utilisation de leurs résultats dans d'autres blocs."
            },
            {
                selector: ".group:not(:first-child) > .group-name",
                text: "Nom : Renommer vos blocs facilitera également leur référencement et l'utilisation de leurs résultats dans d'autres blocs."
            },
            {
                selector: ".group.text > .data-text-container",
                text: "Exemple, 'Avec le personnage #personnage et le lieu [lieu de départ]écris un poème de 8 lignes.'<br /><br />Vous pouvez référencer des blocs textes mais aussi une image pour par exemple la faire décrire par le génerateur de texte"
            },
            {
                selector: ".group.static > .data-text-container",
                text: "Exemple, 'Avec le personnage #personnage et le lieu [lieu de départ]écris un poème de 8 lignes.'<br /><br />Vous pouvez écrire du texte et référencer d'autres bloc textes pour combiner leurs résultats.<br /><br />Vous pouvez aussi référencer des images, qui seront alors ajoutées comme code HTML, pour leur affichage uniquement. Cela vous permet d'utiliser un bloc Static Text pour créer une mise en page des résultats images."
            },
            {
                selector: ".group.image > .data-text-container",
                text: "Description de l'image sous forme de mots-clés visuels, vous pouvez utiliser #nom ou [nom de bloc] pour obtenir des résultats à partir d'un autre bloc. Pour les styles, soyez aussi descriptif et précis que possible pour de meilleurs résultats. Exemple, 'peinture à l'huile 18e siècle', 'logo vectoriel couleurs plates', etc.<br /><br />Vous pouvez faire référence à des blocs de texte mais aussi à un bloc d'image : il sera utilisé comme image de départ (mode image à image) ou comme structure (mode controlnet).<br /><br />Exemple : '#personnage #paysage nuit clair de lune peinture à l'huile 18e siècle'"
            },
        ]
    ,

    en:
        [
            {
                "selector": ".inline-reference-text.not-ready",
                "text": "Reference not yet available. The mentioned block has no results to display."
            },
            {
                "selector": ".inline-reference-text.not-valid",
                "text": "Invalid reference. The mentioned block does not exist!"
            },
            {
                selector: ".open-btn",
                text: "Open: default mode. The data text in the data field is saved for later use by the app's users, and is writable. The transformation field is always saved for future app uses, and is writable."
            },
            {
                selector: ".entry-btn",
                text: "Entry: makes the data field (upper field) an ephemeral input. It'll be blank when the app is reloaded, ready for an user to fill it in. The transform is made read-only and saved for later use."
            },
            {
                selector: ".lock-btn",
                text: "Lock: makes the data and transform fields read-only. Both are saved for later use."
            },
            {
                selector: ".list-mode-btn",
                text: "List mode: turns a list-like text result into a list dropdown, so you can choose one of the answer."
            },
            {
                selector: ".refresh-btn",
                text: "Refresh: requests to generate a new result."
            },
            {
                selector: ".image-to-image-btn",
                text: "Image-to-image mode: the entire image referenced in the data field is used as a starting point. Note that only the first image referenced is used."
            },
            {
                selector: ".controlnet-btn",
                text: "Controlnet mode: the structure of the image referenced in the data field will be used to constrain the image. Note that only the first image referenced is used."
            },
            {
                selector: ".clear-btn",
                text: "Clear: remove the imported image from the block."
            },
            {
                selector: ".group:first-child > .group-name",
                text: "Name of the first block: The name of the first (top-left) block is automatically used as the name of your app.<br /><br />Renaming your blocks will also make it easier to reference them and to use their results in other blocks. "
            },
            {
                selector: ".group:not(:first-child) > .group-name",
                text: "Name: renaming your blocks will make it easier to reference them and to use their results in other blocks. "
            },
            {
                selector: ".group.text > .data-text",
                text: "Example, 'With the character #character and the place [place of departure]'<br /><br />You can reference text blocks but also an image too, for example to ask the text generator to describe it."
            },
            {
                selector: ".group.text > .transform-text",
                text: "Example, 'write an 8 line poem.'"
            },
            {
                selector: ".group.image > .data-text",
                text: "Description of the image as visual keywords, You can use #name or [another name] to get results from another block.<br /><br />You can reference text blocks but also an image block too: it will used as a start image (image to image mode) or as a structure (controlnet mode).<br /><br />Example: '#character #landscape night moonlight'"
            },
            {
                selector: ".group.image > .transform-text",
                text: "Static part of the description to use for generating the image, for example a visual style. Be as descriptive and precise as possible for best results. Example, 'oil painting 18th century', 'vector logo flat colors', etc."
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
                        allowHTML: true,
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

// Utils
// This function checks if all languages in the TOOLTIPS object have the same keys.
function checkTooltipConsistency() {
    const languages = Object.keys(TOOLTIPS);
    const referenceLanguage = languages[0];
    const referenceKeys = TOOLTIPS[referenceLanguage].map(item => item.selector);

    const missingKeys = {};

    for (const lang of languages) {
        const langKeys = TOOLTIPS[lang].map(item => item.selector);

        for (const key of referenceKeys) {
            if (!langKeys.includes(key)) {
                if (!missingKeys[lang]) {
                    missingKeys[lang] = [];
                }
                missingKeys[lang].push(key);
            }
        }
    }

    return missingKeys;
}
