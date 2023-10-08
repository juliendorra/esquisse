import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

const PREFIX = "USER_";

const env = Deno.env.toObject();

console.log(env)


const userEntries = Object.entries(env)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, value]) => [key.replace(PREFIX, ''), value]);

console.log('Loaded user data from environment variables ', userEntries);

// A helper function to perform Basic Auth check
export async function basicAuth(request: Request): Promise<boolean> {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
        console.log('Authorization header missing');
        return false;
    }

    const encodedCreds = authorization.split(" ")[1];
    if (!encodedCreds) {
        console.log('Credentials not provided in Authorization header');
        return false;
    }

    const decodedCreds = atob(encodedCreds);
    const [username, password] = decodedCreds.split(":");

    console.log(`Received authorization request for user: ${username}`);

    // Check credentials
    for (const [envUser, envHash] of userEntries) {
        if (envUser === username) {
            if (await bcrypt.compare(password, envHash)) {
                console.log(`Authentication successful for user: ${username}`);
                return true;
            } else {
                console.log(`Invalid password for user: ${username}`);
                return false;
            }
        }
    }

    console.log(`User not found: ${username}`);
    return false;
}
