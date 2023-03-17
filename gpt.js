export async function callGPT(data, transform) {
    var apiKey = '';
    var apiUrl = 'https://api.openai.com/v1/chat/completions';

    var payload = {
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "user",
                content: data + " " + transform,
            },
        ],
        temperature: 0.2,
        max_tokens: 1200,
    };

    var options = {
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        'body': JSON.stringify(payload),
    };

    var response = await fetch(
        apiUrl,
        options);


    var result = await response.json();

    return result.choices[0].message.content.trim();
}