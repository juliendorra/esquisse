import "https://deno.land/x/dotenv/load.ts";
import "https://deno.land/x/dotenv/load.ts";
import Replicate from "npm:replicate";

export { callModel as callGPT };

const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
const fireworksApiKey = Deno.env.get("FIREWORKS_API_KEY");
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

if (!openAiApiKey) {
    throw new Error("[LLM] missing OPEN_API_KEY environment variable in deployement " + Deno.env.get("DENO_DEPLOYMENT_ID"));
}
if (!fireworksApiKey) {
    throw new Error("[LLM] missing FIREWORKS_API_KEY environment variable in deployement " + Deno.env.get("DENO_DEPLOYMENT_ID"));
}
if (!replicateApiKey) {
    throw new Error("[LLM] missing REPLICATE_API_KEY environment variable in deployement " + Deno.env.get("DENO_DEPLOYMENT_ID"));
}
if (!geminiApiKey) {
    throw new Error("[LLM] missing GEMINI_API_KEY environment variable in deployement " + Deno.env.get("DENO_DEPLOYMENT_ID"));
}

const gptApiUrl = 'https://api.openai.com/v1/chat/completions';
const fireworksApiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';

const MODELS = {
    GEMINI_FLASH: {
        name: "gemini-1.5-flash-latest",
        caller: (params) => new Gemini(geminiApiKey).call(params),
        fallback: "REPLICATE_LLAVA",
    },
    GEMINI_PRO: {
        name: "gemini-1.5-pro-latest",
        caller: (params) => new Gemini(geminiApiKey).call(params),
        fallback: "REPLICATE_LLAVA",
    },
    GPT4O: {
        name: "gpt-4o",
        caller: (params) => new GPT(openAiApiKey).call(params),
        fallback: "GEMINI_PRO",
    },
    GPT4O_MINI: {
        name: "gpt-4o-mini",
        caller: (params) => new GPT(openAiApiKey).call(params),
        fallback: "GEMINI_FLASH",
    },
    REPLICATE_LLAVA: {
        name: "replicate-llava",
        caller: (params) => new ReplicateLLAVA(replicateApiKey).call(params),
        fallback: "FIRE_LLAVA",
    },
    FIRE_LLAVA: {
        name: "firellava-13b",
        caller: (params) => new FireLLAVA(fireworksApiKey).call(params),
        fallback: null,
    },
};

const PRIMARY_QUALITY_MODEL = MODELS.GPT4O;
const PRIMARY_FAST_MODEL = MODELS.GPT4O_MINI;


class GPT {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async call({ data, image, model }) {
        const modelName = model;
        console.log("[LLM] calling ChatGPT using model: ", modelName);

        let payload;
        if (image) {
            payload = {
                model: modelName,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: data,
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`,
                                    detail: "low"
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.2,
                max_completion_tokens: 2000,
            };
        } else {
            payload = {
                model: modelName,
                messages: [
                    {
                        role: "user",
                        content: data,
                    },
                ],
                temperature: 0.2,
                max_completion_tokens: 2000,
            };
        }

        const options = {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.apiKey,
            },
            'body': JSON.stringify(payload),
        };

        const response = await fetch(gptApiUrl, options);
        if (!response.ok) {
            throw new Error(`[LLM] HTTP error! status: `, response.status);
        }
        console.log("[LLM] GPT sent us the result");
        const result = await response.json();
        return result.choices[0].message.content.trim();
    }
}
class Gemini {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async call({ data, image, model }) {
        console.log("[LLM] calling Gemini using model: ", model);

        let payload;
        if (image) {
            payload = {
                contents: [{
                    parts: [
                        { text: data },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.2,
                    max_output_tokens: 2000
                }
            };
        } else {
            payload = {
                contents: [{
                    parts: [
                        { text: data }
                    ]
                }],
                generationConfig: {
                    temperature: 0.2,
                    max_output_tokens: 2000
                }
            };
        }

        const options = {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': JSON.stringify(payload)
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
            options
        );

        if (!response.ok) {
            throw new Error(`[LLM] HTTP error! status: ${response.status}`);
        }

        console.log("[LLM] Gemini sent us the result");
        const result = await response.json();
        return result.candidates[0].content.parts[0].text.trim();
    }
}

class FireLLAVA {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async call({ data, image }) {
        console.log("[LLM] calling FireLLAVA using Fireworks AI");

        const payload = {
            model: "accounts/fireworks/models/firellava-13b",
            max_tokens: 512,
            top_p: 1,
            top_k: 40,
            presence_penalty: 0,
            frequency_penalty: 0.3,
            temperature: 0.2,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: data,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${image}`,
                            }
                        }
                    ]
                }
            ]
        };

        const options = {
            'method': 'POST',
            'headers': {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.apiKey,
            },
            'body': JSON.stringify(payload),
        };

        const response = await fetch(fireworksApiUrl, options);
        if (!response.ok) {
            throw new Error(`[LLM] HTTP error! status: ${response.status}`);
        }
        console.log("[LLM] FireLLAVA sent us the result");
        const result = await response.json();
        return result.choices[0].message.content.trim();
    }
}

class ReplicateLLAVA {
    constructor(apiKey) {
        this.replicate = new Replicate({
            auth: apiKey,
        });
    }

    async call({ data, image, qualityEnabled }) {
        const visionModel = qualityEnabled ?
            "yorickvp/llava-v1.6-34b:41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174"
            : "yorickvp/llava-v1.6-mistral-7b:19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874";

        const output = await this.replicate.run(
            visionModel,
            {
                input: {
                    image: `data:image/jpeg;base64,${image}`,
                    top_p: 1,
                    prompt: data,
                    max_tokens: 2000,
                    temperature: 0.2
                }
            }
        );

        return output.join("");
    }
}
export async function callModel({ data, image, qualityEnabled = false }) {
    const maxAttempts = 2;
    let currentModel = qualityEnabled ? PRIMARY_QUALITY_MODEL : PRIMARY_FAST_MODEL;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const result = await currentModel.caller({ data, image, qualityEnabled, model: currentModel.name });
            return result;
        } catch (error) {
            console.error(`[LLM] Attempt ${attempt + 1} failed for model ${currentModel.name}:`, error);

            if (currentModel.fallback) {
                console.log(`[LLM] Falling back to ${MODELS[currentModel.fallback].name}`);
                currentModel = MODELS[currentModel.fallback];
            } else {
                throw new Error("[LLM] All fallback options exhausted");
            }
        }
    }

    throw new Error(`[LLM] Failed to generate response after ${maxAttempts} attempts`);
} 