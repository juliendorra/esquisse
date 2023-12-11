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
    console.error(`Stability not available: ${error}`);
}

const apiHost = "https://api.stability.ai";

type StabilityParameters = {
    prompt: string,
    negativeprompt: string,
    image?: Uint8Array,
    format: string,
    qualityEnabled: boolean,
    maxAttempts: number,
}

export async function tryGenerate(
    {
        prompt,
        image,
        negativeprompt,
        format,
        qualityEnabled = false,
        maxAttempts = 3,
    }: StabilityParameters
) {
    let generated;

    for (let i = 0; i < maxAttempts; i++) {
        generated = await generate({ prompt, image, negativeprompt, format, qualityEnabled });

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

                generated = await generate({ prompt: cleanedPromptToTest, image, negativeprompt, format, qualityEnabled });

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

export async function generate(
    {
        prompt,
        image,
        negativeprompt,
        format,
        qualityEnabled = false
    }


) {

    const engine = qualityEnabled ? QUALITY_EXPENSIVE_MODEL : FAST_CHEAP_MODEL;

    console.log("Calling Stability with model: ", engine);

    const width = format == "wide" ? engine.widthWide : engine.width;
    const height = format == "wide" ? engine.heightWide : engine.height;;

    const step_count = engine.steps;

    const generationType = image ? "image-to-image" : "text-to-image";

    const url = `${apiHost}/v1/generation/${engine.id}/${generationType}`;

    console.log("[STABILITY] API CALLED: ", url)

    try {
        let body;
        let headers = {
            Accept: "image/png",
            Authorization: apiKey,
        };

        if (image) {
            // Use FormData for image-to-image generation
            const formData = new FormData();

            formData.append('init_image', new File([image], 'image.jpeg', { type: 'image/jpeg' }));

            formData.append('cfg_scale', '7');
            formData.append('clip_guidance_preset', 'FAST_BLUE');

            // as of Stability API v1, width and height cannot be set for image-to-image

            formData.append('samples', '1');
            formData.append('seed', '0');
            formData.append('steps', step_count.toString());
            formData.append('text_prompts[0][text]', prompt);
            formData.append('text_prompts[0][weight]', '1.0');

            // if (negativeprompt) {
            //     formData.append('text_prompts[1][text]', negativeprompt);
            //     formData.append('text_prompts[1][weight]', '-1.0');
            // }

            body = formData;
            // We don't need to set Content-Type for FormData

        } else {
            // Use JSON for text-to-image generation
            body = JSON.stringify({
                cfg_scale: 7,
                clip_guidance_preset: "FAST_BLUE",
                height: height,
                width: width,
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
            });
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
        });

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
