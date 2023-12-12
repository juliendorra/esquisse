import "https://deno.land/x/dotenv/load.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY");

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

    let model = image ? "gpt-4-vision-preview" : (qualityEnabled ? "gpt-4-1106-preview" : "gpt-3.5-turbo-1106");

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
