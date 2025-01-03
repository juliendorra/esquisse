
import tippy, { roundArrow } from "https://cdn.jsdelivr.net/npm/tippy.js@6/+esm";
// import 'https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy.min.css';

export { setTooltips, setAccessibleDescriptions, TOOLTIPS };

const LANGUAGE_CODE = navigator.language.split('-')[0];

const TOOLTIPS =
{
    fr:
        [
            {
                selector: ".drag-handle",
                text: "Poignée de déplacement: Cliquez et glissez pour déplacer ce bloc. Cliquez et relacher pour sélectionner ce bloc et déplacer un goupe de bloc d'un seul mouvement."
            },
            {
                selector: ".inline-reference-text.not-ready",
                text: "Référence pas encore disponible. Le bloc mentionné n'a pas de résultat à afficher."
            },
            {
                selector: ".inline-reference-text.not-valid",
                text: "Référence invalide. Le bloc mentionné n'existe pas !"
            },
            {
                selector: ".clean-up-refs-btn",
                text: "Nettoie les références : Supprime les références invalides dans le texte en supprimant leur # ou [] tout en gardant le texte. Ce bouton n'apparaît que lorsque des références invalides sont détectées."
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
                text: "Mode texte : affiche le résultat au format texte brut. Cela permet par exemple de visualiser et copier le code brut renvoyé par un bloc Text Generator."
            },
            {
                selector: ".list-mode-btn",
                text: `Mode liste : affiche un résultat texte semblable à une liste comme un menu déroulant, afin que vous puissiez choisir l'une des réponses. Fonctionne avec les listes à puces et tirets, listes numérotées, listes à virgules… Demandez le bon format lorsque vous générez du texte avec un bloc Text Generator. Vous pouvez aussi créer des listes de références manuellement dans un bloc Static Text.<br /><br />
                Formats reconnus:<br /><br />
                - item<br /><br />
                * item<br /><br />
                1. item<br /><br />
                1/ item<br /><br />
                "item1", "item2", and "item3"<br /><br />
                item1, item2, item3`
            },
            {
                selector: ".refresh-btn",
                text: "Actualiser : demande la génération d'un nouveau résultat."
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
                text: "Exemple, 'Avec le personnage #personnage et le lieu [lieu de départ] écris un poème de 8 lignes.'<br /><br />Vous pouvez référencer des blocs textes mais aussi une image pour par exemple la faire décrire par le générateur de texte. Notez que seule la première image référencée est utilisée."
            },
            {
                selector: ".group.static > .data-text-container",
                text: "Exemple, 'Avec le personnage #personnage et le lieu [lieu de départ] écris un poème de 8 lignes.'<br /><br />Vous pouvez écrire du texte et référencer d'autres blocs textes pour combiner leurs résultats.<br /><br />Vous pouvez aussi référencer des images, qui seront alors ajoutées comme code HTML, pour leur affichage uniquement. Cela vous permet d'utiliser un bloc Static Text pour créer une mise en page des résultats images."
            },
            {
                selector: ".group.image > .data-text-container",
                text: "Description de l'image sous forme de mots-clés visuels, vous pouvez utiliser #nom ou [nom de bloc] pour obtenir des résultats à partir d'un autre bloc. Pour les styles, soyez aussi descriptif et précis que possible pour de meilleurs résultats. Exemple, 'peinture à l'huile 18e siècle', 'logo vectoriel couleurs plates', etc.<br /><br />Vous pouvez faire référence à des blocs de texte mais aussi à un bloc d'image : il sera utilisé comme image de départ (mode image à image) ou comme structure (mode controlnet).<br /><br />Exemple : '#personnage #paysage nuit clair de lune peinture à l'huile 18e siècle'"
            },
        ],

    en:
        [
            {
                selector: ".drag-handle",
                text: "Drag Handle: Click and drag to move this block. Click and release to select this block and move a group of blocks in one gesture."
            },
            {
                selector: ".inline-reference-text.not-ready",
                text: "Reference not yet available. The mentioned block has no results to display."
            },
            {
                selector: ".inline-reference-text.not-valid",
                text: "Invalid reference. The mentioned block does not exist!"
            },
            {
                selector: ".clean-up-refs-btn",
                text: "Clean up references: Removes invalid references in the text, by deleting their # or [], while keeping the text. This button only appears when invalid references are detected."
            },
            {
                selector: ".entry-btn",
                text: "Input Block Mode: Once this button is activated, the data field becomes a temporary input field. It will be empty when the application is reloaded, ready for a user to fill in. Tip: Use a dedicated Static Text block as an input block for your users."
            },
            {
                selector: ".html-mode-btn",
                text: "HTML Mode: This is the default mode. Displays the result as rich HTML text with headings, lists, text formatting, similar to a web page, if these elements exist in the result."
            },
            {
                selector: ".text-mode-btn",
                text: "Text Mode: Displays the result in plain text format. This allows, for example, to view and copy the raw code returned by a Text Generator block."
            },
            {
                selector: ".list-mode-btn",
                text: "List mode: turns a list-like text result into a list dropdown, so you can choose one of the answers."
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
                text: "Controlnet mode: the structure of the image referenced in the data field will be used to constrain the image. Note that only the first referenced image is used."
            },
            {
                selector: ".clear-btn",
                text: "Clear: remove the imported image from the block."
            },
            {
                selector: ".group.image > .download-btn",
                text: "Download: Downloads the image generated by this block."
            },
            {
                selector: ".group:first-child > .group-name",
                text: "Name of the first block: The name of the first (top-left) block is automatically used as the name of your app.<br /><br />Renaming your blocks will also make it easier to reference them and to use their results in other blocks."
            },
            {
                selector: ".group:not(:first-child) > .group-name",
                text: "Name: renaming your blocks will make it easier to reference them and to use their results in other blocks."
            },
            {
                "selector": ".group.text > .data-text-container",
                "text": "Example: 'With character #character and location [starting location], write an 8-line poem.'<br /><br />You can reference text blocks but also an image, for instance, to have it described by the text generator. Note that only the first referenced image is used."
            },
            {
                "selector": ".group.static > .data-text-container",
                "text": "Example: 'With the character #character and the location [starting location], write an 8-line poem.'<br /><br />You can write text and reference other text blocks to combine their results.<br /><br />You can also reference images, which will then be added as HTML code, for display purposes only. This allows you to use a Static Text block to create a layout for the image results."
            },
            {
                "selector": ".group.image > .data-text-container",
                "text": "Description of the image by visual keywords. You can use #name or [block name] to get results from another block. For styles, be as descriptive and precise as possible for better results. Example: '18th-century oil painting', 'flat color vector logo', etc.<br /><br />You can reference text blocks but also an image block: it will be used as a starting image (image-to-image mode) or as a structure (ControlNet mode).<br /><br />Example: '#character #landscape moonlit night 18th-century oil painting'"
            },
        ]
};

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