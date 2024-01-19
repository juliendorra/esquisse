import "https://deno.land/x/dotenv/load.ts";
import { base64ToUint8Array } from "./utility.ts";

const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
const SEGMIND_API_KEY = Deno.env.get("SEGMIND_API_KEY");

const MODELS = {
    TEXT_TO_IMAGE_FAST_CHEAP: {
        endpoint: "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
        id: "stable-diffusion-xl-1024-v1-0",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        steps: 15,
    },
    TEXT_TO_IMAGE_QUALITY_EXPENSIVE: {
        endpoint: "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
        id: "stable-diffusion-xl-1024-v1-0",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        steps: 45,
    },
    IMAGE_TO_IMAGE_FAST_CHEAP: {
        endpoint: "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image",
        id: "stable-diffusion-xl-1024-v1-0",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        steps: 15,
    },
    IMAGE_TO_IMAGE_QUALITY_EXPENSIVE: {
        endpoint: "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image",
        id: "stable-diffusion-xl-1024-v1-0",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        steps: 45,
    },
    CONTROLNET_FAST_CHEAP: {
        endpoint: "https://api.segmind.com/v1/ssd-canny",
        id: "ssd-canny",
        steps: 15,
    },
    CONTROLNET_QUALITY_EXPENSIVE: {
        endpoint: "https://api.segmind.com/v1/ssd-canny",
        id: "ssd-canny",
        steps: 30,
    }
};


type ImageGenParameters = {
    prompt: string,
    negativeprompt: string,
    image?: string,
    format: string,
    qualityEnabled: boolean,
    controlnetEnabled: boolean,
    maxAttempts: number,
}

type ImageGenGenerated = {
    image?: ArrayBuffer,
    error?: string,
    bannedword?: string,
}

export async function tryGenerate({
    prompt,
    image,
    negativeprompt,
    format,
    qualityEnabled = false,
    controlnetEnabled = false,
    maxAttempts = 3,
}: ImageGenParameters): Promise<ImageGenGenerated> {

    if (!STABILITY_API_KEY) {
        throw new Error("Missing STABILITY_API_KEY environment variable");
    }

    if (!SEGMIND_API_KEY) {
        throw new Error("Missing SEGMIND_API_KEY environment variable");
    }

    let generated;

    for (let i = 0; i < maxAttempts; i++) {
        generated = await generate({
            prompt,
            image,
            negativeprompt,
            format,
            qualityEnabled,
            controlnetEnabled
        });


        if (generated.isValid) {
            return { image: generated.data };
        }

        if (generated.isInvalidPrompt) {

            console.log(
                { isInvalidPrompt: generated.isInvalidPrompt },
                "Prompt invalid, trying with words removed",
            );

            return handleInvalidPrompt({
                prompt,
                image,
                negativeprompt,
                format,
                qualityEnabled,
                controlnetEnabled
            });
        }
        if (generated.isBlurred) {
            return { image: generated.data };
        }

    }

    console.error("Image generation failed after maximum attempts");
    return { error: generated.error };
}

function handleInvalidPrompt({ prompt, image, negativeprompt, format, qualityEnabled, controlnetEnabled }) {

    const words: Set<string> = new Set(prompt.split(" "));
    let resolvedCount = 0;
    let hasValidResult = false;
    let validResult: any = null;

    return new Promise((resolve, reject) => {
        for (const word of words) {
            const pattern = new RegExp("\\b" + word + "\\b", "g");
            const cleanedPrompt = prompt.replace(pattern, '');

            console.log("[IMAGE GENERATION] testing cleaned prompt", cleanedPrompt);

            generate({
                prompt: cleanedPrompt,
                image,
                negativeprompt,
                format,
                qualityEnabled,
                controlnetEnabled
            }).then(generated => {
                resolvedCount++;
                if (generated.isValid && !hasValidResult) {
                    hasValidResult = true;
                    console.log("[IMAGE GENERATION] Banned word was:", word)
                    validResult = { image: generated.data, bannedword: word };
                    resolve(validResult);
                } else if (resolvedCount === words.size && !hasValidResult) {
                    console.log("[IMAGE GENERATION] No valid prompt found removing one word, generation failed");
                    resolve({ error: "Invalid prompt" });
                }
            });
        };
    });
}


// Function to call the appropriate API based on the parameters
async function generate({ prompt, image, negativeprompt, format, qualityEnabled, controlnetEnabled }) {
    if (image && controlnetEnabled) {
        return await callSegmindAPI(prompt, image, negativeprompt, qualityEnabled);
    } else {
        return await callStabilityAPI(prompt, image, negativeprompt, format, qualityEnabled);
    }
}

// Function to call the Segmind API
async function callSegmindAPI(prompt, image, negativeprompt, qualityEnabled) {
    const model = qualityEnabled ? MODELS.CONTROLNET_FAST_CHEAP : MODELS.CONTROLNET_FAST_CHEAP;

    const data = JSON.stringify({
        image: image,
        prompt: prompt,
        // negative_prompt: negativeprompt,
        samples: 1,
        scheduler: "UniPC",
        num_inference_steps: model.steps,
        guidance_scale: 7.5,
        seed: -1,
        controlnet_scale: 0.8,
        base64: false
    });

    try {
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SEGMIND_API_KEY
            },
            body: data
        });

        if (!response.ok) {
            throw { response };
        }

        const responseBuffer = await response.arrayBuffer();
        return { data: responseBuffer, isValid: true };

    } catch (error) {
        console.error("Error in Segmind API call:", error);
        return { error: error.statusText };
    }
}

// Function to call the Stability API
async function callStabilityAPI(prompt, image, negativeprompt, format, qualityEnabled) {

    let model;

    if (image) {
        model = qualityEnabled ? MODELS.IMAGE_TO_IMAGE_QUALITY_EXPENSIVE : MODELS.IMAGE_TO_IMAGE_FAST_CHEAP;
    }
    else {
        model = qualityEnabled ? MODELS.TEXT_TO_IMAGE_QUALITY_EXPENSIVE : MODELS.TEXT_TO_IMAGE_FAST_CHEAP;
    }

    console.log("[IMAGE GENERATION] API ENDPOINT: ", model.endpoint)

    const width = format === 'wide' ? model.widthWide : model.width;
    const height = format === 'wide' ? model.heightWide : model.height;

    let body;
    let headers = {
        Accept: "image/png",
        Authorization: STABILITY_API_KEY,
    };

    if (image) {
        // Use FormData for image-to-image generation
        const formData = new FormData();

        formData.append('init_image', new File([base64ToUint8Array(image)], 'image.jpeg', { type: 'image/jpeg' }));

        formData.append('cfg_scale', '7');
        formData.append('clip_guidance_preset', 'FAST_BLUE');

        // as of Stability API v1, width and height cannot be set for image-to-image

        formData.append('samples', '1');
        formData.append('seed', '0');
        formData.append('steps', model.steps.toString());
        formData.append('text_prompts[0][text]', prompt);
        formData.append('text_prompts[0][weight]', '1.0');

        // if (negativeprompt) {
        //     formData.append('text_prompts[1][text]', negativeprompt);
        //     formData.append('text_prompts[1][weight]', '-1.0');
        // }

        body = formData;
        // We don't need to set Content-Type for FormData

    } else {
        // Prepare JSON body for text-to-image generation
        body = JSON.stringify({
            cfg_scale: 7,
            clip_guidance_preset: "FAST_BLUE",
            height: height,
            width: width,
            samples: 1,
            seed: 0,
            steps: model.steps,
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

    try {
        const response = await fetch(
            model.endpoint,
            {
                method: 'POST',
                headers: headers,
                body: body
            });

        if (!response.ok) {
            throw { response };
        }

        for (let [key, value] of response.headers) {
            console.log(`${key}: ${value}`);
        }

        console.log("[IMAGE GENERATION] Finish-Reason: ", response.headers.get("Finish-Reason"))

        const responseBuffer = await response.arrayBuffer();

        const isValid = response.headers.get("Finish-Reason") === "SUCCESS";

        const isBlurred = response.headers.get("Finish-Reason") === "CONTENT_FILTERED";

        return { data: responseBuffer, isValid, isBlurred };

    } catch (error) {
        if (error.response) {

            let errorData;

            try {
                errorData = await error.response.json();

                const isInvalidPrompt = errorData.name == "invalid_prompts";

                console.error("[STABILITY] error response data", errorData);

                return { isInvalidPrompt };
            }
            catch {

                console.error("[STABILITY] unknown fetch error", error);
                return { error: "unknown error" };
            }
        }
        else {
            console.error("[STABILITY] unknown fetch error", error);
            return { error: "unknown error" };
        }
    }
}
