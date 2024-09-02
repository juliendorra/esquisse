import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { checkTooltipConsistency } from "../static/tooltips.js"; // Adjust the path if necessary

Deno.test("Tooltips: Check consistency of keys across languages", () => {
    // Use type assertion to ensure TypeScript knows the correct type
    const missingKeys = checkTooltipConsistency() as Record<string, string[]>;

    let missingKeysFound = false;

    for (const lang in missingKeys) {
        if (missingKeys[lang].length > 0) {
            console.error(`Language '${lang}' is missing keys: ${missingKeys[lang].join(", ")}`);
            missingKeysFound = true;
        }
    }

    assertEquals(missingKeysFound, false, "Some languages are missing keys. Check the error output above for details.");
});