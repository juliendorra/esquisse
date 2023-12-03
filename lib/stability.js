import "https://deno.land/x/dotenv/load.ts";

const apiKey = Deno.env.get("STABILITY_API_KEY");

const FAST_CHEAP_MODEL = {
    id: "stable-diffusion-xl-1024-v1-0",
    width: 1024,
    height: 1024,
    widthWide: 1152,
    heightWide: 896,
    steps: 15,

}
const QUALITY_EXPENSIVE_MODEL = {
    id: "stable-diffusion-xl-1024-v1-0",
    width: 1024,
    height: 1024,
    widthWide: 1152,
    heightWide: 896,
    steps: 45,
}

try {
    if (!apiKey) {
        throw new Error("missing STABILITY_API_KEY environment variable");
    }
}
catch (error) {
    console.error(`GPT not available: ${error}`);
}

const apiHost = "https://api.stability.ai";

export async function tryGenerate(
    prompt,
    negativeprompt,
    format,
    qualityEnabled = false,
    maxAttempts = 3,
) {
    let generated;

    for (let i = 0; i < maxAttempts; i++) {
        generated = await generate(prompt, negativeprompt, format, qualityEnabled);

        if (generated.isValid) {
            return { image: generated.data };
        }

        else if (generated.isInvalidPrompt) {
            console.log(
                { isInvalidPrompt: generated.isInvalidPrompt },
                "Prompt invalid, trying with words removed",
            );

            let cleanedPromptToTest;

            const words = prompt.split(" ");
            const wordsSet = new Set(words);
            const uniqueWords = Array.from(wordsSet);

            for (const word of uniqueWords) {
                console.log({ word: word }, "removing word ");

                const pattern = new RegExp("\\b" + word + "\\b", "g");
                cleanedPromptToTest = prompt.replace(pattern, "");

                console.log("[STABILITY] testing cleaned prompt", cleanedPromptToTest);

                generated = await generate(cleanedPromptToTest, negativeprompt, format, qualityEnabled);

                if (generated.isValid) {
                    console.log("[STABILITY] Banned word was:", word)
                    return { image: generated.data, bannedword: word };
                }
            }

            console.log(
                {
                    isValid: generated.isValid,
                },
                "No valid prompt found removing one word, generation failed",
            );

            console.log("No valid prompt found removing one word, generation failed");

            return { error: "invalid prompt" }; // no image
        }

        console.log(
            {
                attempt: i,
                attemptsLeft: maxAttempts - i,
                isBlurred: generated.isBlurred,
                isValid: generated.isValid,
                error: generated.error,
            },
            "Image generation failed, requesting new image",
        );
    }
    // blurred image
    if (generated.isBlurred) {
        return { image: generated.data };
    }

    // no image
    else {
        console.error("No image");
        return { error: generated.error };
    }
}

export async function generate(prompt, negativeprompt, format, qualityEnabled = false) {

    const engine = qualityEnabled ? QUALITY_EXPENSIVE_MODEL : FAST_CHEAP_MODEL;

    console.log("Calling Stability with model: ", engine);

    const width = format == "wide" ? engine.widthWide : engine.width;
    const height = format == "wide" ? engine.heightWide : engine.height;;

    const step_count = engine.steps;

    const url = `${apiHost}/v1alpha/generation/${engine.id}/text-to-image`;

    try {
        const response = await fetch(
            url,
            {
                method: 'POST',
                body: JSON.stringify({
                    cfg_scale: 7,
                    clip_guidance_preset: "FAST_BLUE",
                    height: height,
                    width: width,
                    // sampler: "K_DPMPP_2M",
                    samples: 1,
                    seed: 0,
                    steps: step_count,
                    text_prompts: [
                        {
                            text: prompt,
                            weight: 1.0,
                        },
                        // {
                        //     text: negativeprompt,
                        //     weight: -1.0,
                        // },
                    ],
                }),
                headers: {
                    "Content-Type": "application/json",
                    Accept: "image/png",
                    Authorization: apiKey,
                }
            },
        );

        if (!response.ok) {
            throw { response };
        }

        for (let [key, value] of response.headers) {
            console.log(`${key}: ${value}`);
        }

        console.log("[STABILITY] Finish-Reason: ", response.headers.get("Finish-Reason"))

        const responseBuffer = await response.arrayBuffer();

        const isValid = response.headers.get("Finish-Reason") == "SUCCESS";
        const isBlurred = response.headers.get("Finish-Reason") == "CONTENT_FILTERED";

        return { data: responseBuffer, isValid, isBlurred };

    } catch (error) {
        if (error.response) {

            const errorData = await error.response.json();
            const isInvalidPrompt = errorData.name == "invalid_prompts";

            console.error("[STABILITY] error response data", errorData);

            return { isInvalidPrompt };
        }
        else {
            console.error("[STABILITY] unknown fetch error", error);
            return { error: "unknown error" };
        }
    }
}
