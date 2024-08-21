import "https://deno.land/x/dotenv/load.ts";
import { base64ToUint8Array } from "./utility.ts";

const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
const SEGMIND_API_KEY = Deno.env.get("SEGMIND_API_KEY");
const FAL_API_KEY = Deno.env.get("FAL_API_KEY");

const MODELS = {
    TEXT_TO_IMAGE_FAST_CHEAP: {
        endpoint: "https://fal.run/fal-ai/flux/schnell",
        width: 1024,
        height: 1024,
        widthWide: 1024,
        heightWide: 576,
        steps: 1,
        caller: getFal(),
    },
    TEXT_TO_IMAGE_QUALITY_EXPENSIVE: {
        endpoint: "https://fal.run/fal-ai/flux/schnell",
        width: 1024,
        height: 1024,
        widthWide: 1024,
        heightWide: 576,
        steps: 4,
        caller: getFal(),
    },

    IMAGE_TO_IMAGE_FAST_CHEAP: {
        endpoint: "https://fal.run/fal-ai/fast-sdxl/image-to-image",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        imageStrength: 0.9,
        guidanceScaleCFG: 7,
        steps: 10,
        caller: getFal(),
    },
    IMAGE_TO_IMAGE_QUALITY_EXPENSIVE: {
        endpoint: "https://fal.run/fal-ai/fast-sdxl/image-to-image",
        width: 1024,
        height: 1024,
        widthWide: 1152,
        heightWide: 896,
        imageStrength: 0.85,
        guidanceScaleCFG: 7,
        steps: 25,
        caller: getFal(),
    },

    CONTROLNET_SEGMIND_FAST_CHEAP: {
        endpoint: "https://api.segmind.com/v1/sdxl-controlnet", //https://www.segmind.com/models/sdxl-controlnet
        steps: 10,
        scheduler: "UniPC",
        controlNetModel: "sdxl_canny",
        guidanceScaleCFG: 6,
        controlnetScale: 0.9,
        caller: getSegmindControlnet(),
    },
    CONTROLNET_SEGMIND_QUALITY_EXPENSIVE: {
        endpoint: "https://api.segmind.com/v1/sdxl-controlnet", //https://www.segmind.com/models/sdxl-controlnet
        steps: 30,
        scheduler: "UniPC",
        controlNetModel: "sdxl_canny",
        guidanceScaleCFG: 6,
        controlnetScale: 0.9,
        caller: getSegmindControlnet(),
    },
    CONTROLNET_FAL_FAST_CHEAP: {
        endpoint: "https://fal.run/fal-ai/fast-sdxl-controlnet-canny",
        steps: 15,
        deepcache: true,
        caller: getFalControlnet(),
    },
    CONTROLNET_FAL_QUALITY_EXPENSIVE: {
        endpoint: "https://fal.run/fal-ai/fast-sdxl-controlnet-canny",
        steps: 30,
        deepcache: false,
        caller: getFalControlnet(),
    },

    REALTIME_TEXT_TO_IMAGE: {
        endpoint: "https://fal.run/fal-ai/fast-lightning-sdxl/",
        width: 1024,
        height: 1024,
        widthWide: 1024,
        heightWide: 576,
        steps: 2,
        caller: getFal(),
    },
    REALTIME_IMAGE_TO_IMAGE: {
        endpoint: "https://fal.run/fal-ai/fast-lightning-sdxl/image-to-image",
        width: 1024,
        height: 1024,
        widthWide: 1024,
        heightWide: 576,
        steps: 2,
        caller: getFal(),
    },
};


type Model = {
    endpoint: string,
    width: number,
    height: number,
    widthWide: number,
    heightWide: number,
    steps: number,
    // optionals, depends on APIs
    id?: string,
    model?: string,
    deepcache?: true,
    scheduler?: string,
    guidanceScaleCFG?: number,
    imageStrength?: number,
    controlNetModel: string,
    controlnetScale: number,
    // the API-specific calling function
    caller: (params: ImageGenParameters, model: Model) => ImageGenGenerated,
}

type ImageGenParameters = {
    prompt: string,
    negativeprompt?: string,
    image?: string,
    format: string,
    qualityEnabled: boolean,
    controlnetEnabled: boolean,
    maxAttempts?: number,
}

type ImageGenGenerated = {
    image?: ArrayBuffer,
    error?: string,
    bannedword?: string,
}

type imageAPIHeaders = {
    "Content-Type"?: string,
    Accept?: string,
    "x-api-key"?: string,
    Authorization?: string,
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

    validateAPIKeys();

    let generated;
    for (let i = 0; i < maxAttempts; i++) {
        generated = await generate({
            prompt,
            image,
            negativeprompt,
            format,
            qualityEnabled,
            controlnetEnabled,
        });

        if (generated.isValid) {
            return { image: generated.data };
        }

        if (generated.isInvalidPrompt) {
            console.log("Prompt invalid, trying with words removed");
            return handleInvalidPrompt({
                prompt,
                image,
                negativeprompt,
                format,
                qualityEnabled,
                controlnetEnabled,
            });
        }

        if (generated.isBlurred) {
            return { image: generated.data };
        }
    }

    console.error("Image generation failed after maximum attempts");
    return { error: generated.error };
}

function validateAPIKeys() {
    if (!STABILITY_API_KEY) {
        throw new Error("Missing STABILITY_API_KEY environment variable");
    }
    if (!SEGMIND_API_KEY) {
        throw new Error("Missing SEGMIND_API_KEY environment variable");
    }
    if (!FAL_API_KEY) {
        throw new Error("Missing FAL_API_KEY environment variable");
    }
}

async function handleInvalidPrompt(params: ImageGenParameters): Promise<ImageGenGenerated> {
    const words: Set<string> = new Set(params.prompt.split(" "));
    let resolvedCount = 0;
    let hasValidResult = false;
    let validResult: any = null;

    return new Promise((resolve) => {
        for (const word of words) {
            const cleanedPrompt = params.prompt.replace(new RegExp(`\\b${word}\\b`, "g"), '');

            generate({ ...params, prompt: cleanedPrompt }).then(generated => {
                resolvedCount++;
                if (generated.isValid && !hasValidResult) {
                    hasValidResult = true;
                    console.log("Banned word was:", word);
                    validResult = { image: generated.data, bannedword: word };
                    resolve(validResult);
                } else if (resolvedCount === words.size && !hasValidResult) {
                    console.log("No valid prompt found after removing one word, generation failed");
                    resolve({ error: "Invalid prompt" });
                }
            });
        }
    });
}

async function generate(params: ImageGenParameters): Promise<any> {

    // text to image models

    if (!params.qualityEnabled && !params.image) {

        return MODELS.TEXT_TO_IMAGE_FAST_CHEAP.caller(params, MODELS.TEXT_TO_IMAGE_FAST_CHEAP);

    }
    else if (params.qualityEnabled && !params.image) {

        return MODELS.TEXT_TO_IMAGE_QUALITY_EXPENSIVE.caller(params, MODELS.TEXT_TO_IMAGE_QUALITY_EXPENSIVE);
    }

    // controlnet models

    else if (!params.qualityEnabled && params.image && params.controlnetEnabled) {

        return MODELS.CONTROLNET_SEGMIND_FAST_CHEAP.caller(params, MODELS.CONTROLNET_SEGMIND_FAST_CHEAP);
    }

    else if (params.qualityEnabled && params.image && params.controlnetEnabled) {

        return MODELS.CONTROLNET_SEGMIND_QUALITY_EXPENSIVE.caller(params, MODELS.CONTROLNET_SEGMIND_QUALITY_EXPENSIVE);

    }

    // image to image models

    else if (!params.qualityEnabled && params.image && !params.controlnetEnabled) {

        return MODELS.IMAGE_TO_IMAGE_FAST_CHEAP.caller(params, MODELS.IMAGE_TO_IMAGE_FAST_CHEAP);

    } else if (params.qualityEnabled && params.image && !params.controlnetEnabled) {

        return MODELS.IMAGE_TO_IMAGE_QUALITY_EXPENSIVE.caller(params, MODELS.IMAGE_TO_IMAGE_QUALITY_EXPENSIVE);
    }
}

function getFal() {
    return async function callFalAPI({ prompt, image, format }: ImageGenParameters, model: Model) {
        const headers = {
            Accept: "image/png",
            Authorization: `Key ${FAL_API_KEY}`,
            "Content-Type": 'application/json',
        };

        const body = image ?
            JSON.stringify({
                model: model.model,
                image_url: `data:image/jpeg;base64,${image}`,
                prompt,
                image_size: format === 'wide' ? 'landscape_16_9' : 'square_hd',
                num_inference_steps: model.steps,
                strength: model.imageStrength,
                guidance_scale: model.guidanceScaleCFG,
                num_images: 1,
                format: 'jpeg',
                sync_mode: true,
                enable_safety_checker: false,

            })
            : JSON.stringify({
                prompt,
                image_size: format === 'wide' ? 'landscape_16_9' : 'square_hd',
                num_inference_steps: model.steps,
                num_images: 1,
                format: 'jpeg',
                sync_mode: true,
                enable_safety_checker: false,
            });

        return fetchAPI(model.endpoint, headers, body);
    };
}

function getSegmindControlnet() {
    return async function callSegmindControlnetAPI({ prompt, image, format }: ImageGenParameters, model: Model): Promise<any> {

        const headers: imageAPIHeaders = {
            "x-api-key": SEGMIND_API_KEY,
            "Content-Type": 'application/json',
        };

        const body = JSON.stringify({
            image: image,
            prompt: prompt,
            // negative_prompt: negativeprompt,
            samples: 1,
            scheduler: model.scheduler,
            num_inference_steps: model.steps,
            guidance_scale: model.guidanceScaleCFG,
            seed: -1,
            controlnet_scale: model.controlnetScale,
            base64: false,
        });

        return fetchAPI(model.endpoint, headers, body);
    }
}

function getFalControlnet() {
    return async function callFalControlnetdAPI({ prompt, image, format }: ImageGenParameters, model: Model): Promise<any> {

        const headers: imageAPIHeaders = {
            Accept: "image/png",
            Authorization: `Key ${FAL_API_KEY}`,
            "Content-Type": 'application/json',
        };


        const body = JSON.stringify({
            prompt,
            control_image_url: `data:image/jpeg;base64,${image}`,
            controlnet_conditioning_scale: 0.5,
            image_size: 'square_hd',
            num_inference_steps: model.steps,
            guidance_scale: 7.5,
            num_images: 1,
            "loras": [],
            format: 'jpeg',
            enable_deep_cache: model.deepcache || false, // might degrades quality
            sync_mode: true,
        });


        return fetchAPI(model.endpoint, headers, body);
    }

}

function getStability() {
    return async function callStabilityAPI({ prompt, image, format }: ImageGenParameters, model: Model): Promise<any> {

        const width = format === 'wide' ? model.widthWide : model.width;
        const height = format === 'wide' ? model.heightWide : model.height;

        let body;

        const headers: imageAPIHeaders = {
            Accept: "image/png",
            Authorization: `Bearer ${STABILITY_API_KEY}`,
        };

        if (image) {
            const formData = new FormData();
            formData.append('init_image', new File([base64ToUint8Array(image)], 'image.jpeg', { type: 'image/jpeg' }));

            formData.append('cfg_scale', '7');
            formData.append('clip_guidance_preset', 'FAST_BLUE');

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
            headers["Content-Type"] = 'application/json';

            body = JSON.stringify({
                cfg_scale: 7,
                clip_guidance_preset: "FAST_BLUE",
                height,
                width,
                samples: 1,
                seed: 0,
                steps: model.steps,
                text_prompts: [{ text: prompt, weight: 1.0 }],
            });

        }

        return fetchAPI(model.endpoint, headers, body);
    }
}

async function fetchAPI(endpoint: string, headers: imageAPIHeaders, body): Promise<any> {

    console.log("[IMAGEGEN] ENDPOINT: ", endpoint);
    console.log("[IMAGEGEN] headers: ", headers);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
        });

        if (!response.ok) {
            throw { response };
        }

        const contentType = response.headers.get("Content-Type");

        if (contentType && contentType.includes("application/json")) {
            // Handle Fal API sync response that package the image in a data url
            const responseJson = await response.json();

            const imageUrl = responseJson.images[0]?.url;

            if (imageUrl.startsWith("data:image/jpeg;base64,")) {
                const base64Image = imageUrl.split(",")[1];
                const imageBuffer = base64ToUint8Array(base64Image);
                return { data: imageBuffer, isValid: true };
            } else {
                throw new Error("[IMAGEGEN] Unexpected image URL format, expected base64 encoded data url");
            }
        } else if (contentType && contentType.includes("image")) {
            // Handle Stability and Segmind API response that returns the image
            const responseBuffer = await response.arrayBuffer();
            let isValid = true;
            let isBlurred = false;

            // handling the stability errors in headers
            if (response.headers.get("Finish-Reason") && response.headers.get("Finish-Reason") !== "SUCCESS") {
                isValid = false;
            }
            if (response.headers.get("Finish-Reason") && response.headers.get("Finish-Reason") === "CONTENT_FILTERED") {
                isBlurred = true;
            }

            return { data: responseBuffer, isValid, isBlurred };

        } else {
            throw new Error("[IMAGEGEN] Unknown response content type");
        }
    } catch (error) {
        console.error("[IMAGEGEN] Error in API call:", error);
        return { error: error.statusText || "Unknown error" };
    }
}
