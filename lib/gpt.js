import "https://deno.land/x/dotenv/load.ts";
import Replicate from "npm:replicate";

const apiKey = Deno.env.get("OPENAI_API_KEY");
const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
const fireworksApiKey = Deno.env.get("FIREWORKS_API_KEY");

if (!apiKey) {
    throw new Error("missing OPEN_API_KEY environment variable");
}
if (!fireworksApiKey) {
    throw new Error("missing FIREWORKS_API_KEY environment variable");
}

const gptApiUrl = 'https://api.openai.com/v1/chat/completions';
const fireworksApiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';

export { callModel as callGPT };

class GPT {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async call(data, image, transform, qualityEnabled) {
        let model = image ? "gpt-4o" : (qualityEnabled ? "gpt-4o" : "gpt-3.5-turbo-0125");
        console.log("calling ChatGPT using model: ", model);

        let payload;
        if (image) {
            payload = {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: data + " " + transform,
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
                max_tokens: 600
            };
        } else {
            payload = {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: data + " " + transform,
                    },
                ],
                temperature: 0.2,
                max_tokens: 2000,
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

        try {
            const response = await fetch(gptApiUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log("GPT4 sent us the result");
            const result = await response.json();
            return result.choices[0].message.content.trim();
        } catch (error) {
            console.error(`Fetch failed: ${error}`);
            return "";
        }
    }
}

class FireLLAVA {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async call(data, image, transform) {
        console.log("calling FireLLAVA using Fireworks AI");

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
                            text: data + " " + transform
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

        try {
            const response = await fetch(fireworksApiUrl, options);
            if (!response.ok) {
                throw new Error(response);
            }
            console.log("FireLLAVA sent us the result");
            const result = await response.json();
            return result.choices[0].message.content.trim();
        } catch (error) {
            console.error(`Fetch failed: ${error.json}`);
            return "";
        }
    }
}

class ReplicateLLAVA {
    constructor(apiKey) {
        this.replicate = new Replicate({
            auth: apiKey,
        });
    }

    async call(data, image, transform, qualityEnabled) {
        const visionModel = qualityEnabled ?
            "yorickvp/llava-v1.6-34b:41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174"
            : "yorickvp/llava-v1.6-mistral-7b:19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874";

        const output = await this.replicate.run(
            visionModel,
            {
                input: {
                    image: `data:image/jpeg;base64,${image}`,
                    top_p: 1,
                    prompt: data + " " + transform,
                    max_tokens: 2000,
                    temperature: 0.2
                }
            }
        );

        return output.join("");
    }
}

export async function callModel({ data, image, transform, qualityEnabled = false }) {
    const gpt = new GPT(apiKey);
    const fireLLAVA = new FireLLAVA(fireworksApiKey);
    const replicateLLAVA = new ReplicateLLAVA(replicateApiKey);

    try {
        if (qualityEnabled) {
            if (image) {
                const result = await gpt.call(data, image, transform, qualityEnabled);
                return result;
            }
            const result = await gpt.call(data, null, transform, qualityEnabled);
            return result;
        } else {
            const result = await gpt.call(data, image, transform, qualityEnabled);
            return result;
        }
    } catch (error) {
        console.error(`Primary model call failed: ${error}`);
        // const replicateResult = await replicateLLAVA.call(data, image, transform, qualityEnabled);
        // return replicateResult;
    }
}
