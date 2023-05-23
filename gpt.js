import "https://deno.land/x/dotenv/load.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY");

if (!apiKey) {
    throw new Error("missing OPEN_API_KEY environment variable");
}

const apiUrl = 'https://api.openai.com/v1/chat/completions';

export async function callGPT(data, transform) {
    const payload = {
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "user",
                content: data + " " + transform + " Answer in 500 characters or less.",
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
