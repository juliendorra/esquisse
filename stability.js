import "https://deno.land/x/dotenv/load.ts";

const apiKey = Deno.env.get("STABILITY_API_KEY");

const FAST_CHEAP_MODEL = {
    id: "stable-diffusion-512-v2-1",
    width: 512,
    height: 512,
    widthWide: 768,
    heightWide: 640,
}

const QUALITY_EXPENSIVE_MODEL = {
    id: "stable-diffusion-xl-1024-v1-0",
    width: 1024,
    height: 1024,
    widthWide: 1152,
    heightWide: 896,

}

if (!apiKey) {
    throw new Error("missing STABILITY_API_KEY environment variable");
}

const STEP_COUNT = 45;
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
            return generated.data;
        }

        if (generated.isInvalidPrompt) {
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

                generated = await generate(prompt, negativeprompt, format, engine);

                if (generated.isValid) {
                    return generated.data;
                }
            }

            console.log(
                {
                    isValid: generated.isValid,
                },
                "No valid prompt found removing one word, generation failed",
            );

            console.log("No valid prompt found removing one word, generation failed");

            return; // no image
        }

        console.log(
            {
                attempt: i,
                attemptsLeft: maxAttempts - i,
                isBlurred: generated.isBlurred,
                isValid: generated.isValid,
            },
            "Image generation failed, requesting new image",
        );
    }

    if (generated.isBlurred) {
        return generated.data;
    } // blurred image
    else {
        console.error("No image");
        return;
    } // no image
}

export async function generate(prompt, negativeprompt, format, qualityEnabled = false) {

    const engine = qualityEnabled ? QUALITY_EXPENSIVE_MODEL : FAST_CHEAP_MODEL;

    console.log("Calling Stability with model: ", engine);

    const width = format == "wide" ? engine.widthWide : engine.width;
    const height = format == "wide" ? engine.heightWide : engine.height;;

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
                    steps: STEP_COUNT,
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

        for (let [key, value] of response.headers) {
            console.log(`${key}: ${value}`);
        }

        const responseBuffer = await response.arrayBuffer();

        console.log(response.headers.get("Finish-Reason"))
        const isValid = response.headers.get("Finish-Reason") == "SUCCESS";
        const isBlurred = response.headers.get("Finish-Reason") == "CONTENT_FILTERED";

        return { data: responseBuffer, isValid, isBlurred };
    } catch (error) {
        console.error(error);

        const errorData = await error.response.json();
        const isInvalidPrompt = errorData.name == "invalid_prompts";

        console.error(errorData, "error response data");

        return { isInvalidPrompt };
    }
}
