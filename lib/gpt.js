import "https://deno.land/x/dotenv/load.ts";
import Replicate from "npm:replicate";

const apiKey = Deno.env.get("OPENAI_API_KEY");
const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");

try {
    if (!apiKey) {
        throw new Error("missing OPEN_API_KEY environment variable");
    }
}
catch (error) {
    console.error(`GPT not available: ${error}`);
}

const apiUrl = 'https://api.openai.com/v1/chat/completions';

export async function callGPT(
    {
        data,
        image,
        transform,
        qualityEnabled = false
    }
) {

    let model = image ? "gpt-4-vision-preview" : (qualityEnabled ? "gpt-4-turbo-preview" : "gpt-3.5-turbo-0125");

    console.log("calling ChatGPT using model: ", model)

    let payload;
    if (image) {
        // Payload for GPT-4 Vision
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
        // Payload for GPT-3 or GPT-4 text models
        payload = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: "Answer in 500 characters or less.",
                },
                {
                    role: "user",
                    content: data + " " + transform,
                },
            ],
            temperature: 0.2,
            max_tokens: 600,
        };
    }

    const options = {
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        'body': JSON.stringify(payload),
    };

    try {
        const response = await fetch(apiUrl, options);

        if (!response.ok && image) {

            console.log("GPT4-vision failed, falling back on LLAVA 1.6 on replicate")

            const replicateResult = await callReplicate({
                data,
                image,
                transform,
                qualityEnabled
            });
            return replicateResult;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        return result.choices[0].message.content.trim();
    } catch (error) {
        console.error(`Fetch failed: ${error}`);
        return ""
    }
}


async function callReplicate(
    {
        data,
        image,
        transform,
        qualityEnabled = false
    }
) {

    const replicate = new Replicate({
        auth: replicateApiKey,
    });

    const visionModel = qualityEnabled ?
        "yorickvp/llava-v1.6-34b:41ecfbfb261e6c1adf3ad896c9066ca98346996d7c4045c5bc944a79d430f174"
        : "yorickvp/llava-v1.6-mistral-7b:19be067b589d0c46689ffa7cc3ff321447a441986a7694c01225973c2eafc874"

    const output = await replicate.run(
        visionModel,
        {
            input: {
                image: `data:image/jpeg;base64,${image}`,
                top_p: 1,
                prompt: data + " " + transform,
                max_tokens: 600,
                temperature: 0.2
            }
        }
    );

    return output.join("");
}