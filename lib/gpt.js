import "https://deno.land/x/dotenv/load.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY");

if (!apiKey) {
    throw new Error("missing OPEN_API_KEY environment variable");
}

const apiUrl = 'https://api.openai.com/v1/chat/completions';

export async function callGPT(data, transform, qualityEnabled = false) {

    let model = qualityEnabled ? "gpt-4-1106-preview" : "gpt-3.5-turbo-1106";

    console.log("calling ChatGPT using model: ", model)

    const payload = {
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
