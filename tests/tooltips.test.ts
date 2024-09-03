import { assertArrayIncludes } from "https://deno.land/std/assert/mod.ts";
import { TOOLTIPS } from "../static/tooltips.js"; // Adjust the path if necessary

Deno.test("Tooltips: Check consistency of selectots across languages", () => {
    type LanguageClasses = {
        [key: string]: { selector: string; text: string; }[];
    };

    const tips = TOOLTIPS as LanguageClasses;

    const allSelectors =
        Array.from(
            new Set(
                Object.values(tips)
                    .flatMap(tooltips => tooltips.map(
                        tooltip => tooltip.selector
                    ))
            ));

    const langkeys: string[] = Object.keys(TOOLTIPS)

    for (const langkey of langkeys) {

        const langSelectors = tips[langkey].map(item => item.selector);

        assertArrayIncludes(langSelectors, allSelectors, `${langkey} is missing keys`);

    }
});