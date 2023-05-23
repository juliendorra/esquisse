const apiKey = Deno.env.get("OPEN_API_KEY");

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
                content: data + " " + transform + " Answer in 1000 characters or less.",
            },
        ],
        temperature: 0.2,
        max_tokens: 1200,
    };

    const options = {
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        'body': JSON.stringify(payload),
    };

    const response = await fetch(
        apiUrl,
        options);


    const result = await response.json();

    return result.choices[0].message.content.trim();
}