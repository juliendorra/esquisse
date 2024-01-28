import "https://deno.land/x/dotenv/load.ts";
import { Request } from "https://deno.land/x/oak/mod.ts";

import { compare } from "./bcrypt.ts";
import { getUserPasswordHash } from "./users.ts";

const PREFIX = "USER_";

const env = Deno.env.toObject();

const userEntries = Object.entries(env)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, value]) => [key.replace(PREFIX, ''), value]);

const envAdmin = Deno.env.get("ADMIN");

console.log('Loaded user data from environment variables ', userEntries);

type AuthResult = { isAuthenticated: boolean, isAdmin: boolean, username: string | null }

// A helper function to perform Basic Auth check
export async function basicAuth(request: Request): Promise<AuthResult> {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
        console.log('Authorization header missing');
        return { isAuthenticated: false, isAdmin: false, username: null };
    }

    const encodedCreds = authorization.split(" ")[1];
    if (!encodedCreds) {
        console.log('Credentials not provided in Authorization header');
        return { isAuthenticated: false, isAdmin: false, username: null };
    }

    const decodedCreds = atob(encodedCreds);
    const [usernameRaw, password] = decodedCreds.split(":");
    const username = usernameRaw.toLowerCase().trim();

    console.log(`Received authorization request for user: ${username}`);

    // Check credentials from env secrets
    for (const [envUser, envHash] of userEntries) {
        if (envUser === username) {
            if (await compare(password, envHash)) {
                console.log(`Env Authentication successful for user: ${username}`);
                return {
                    isAuthenticated: true,
                    isAdmin: username === envAdmin,
                    username: username
                };
            } else {
                console.log(`Invalid password for user: ${username}`);
                return {
                    isAuthenticated: false,
                    isAdmin: username === envAdmin,
                    username: username
                };
            }
        }
    }

    // Check credentials from kv stores
    const kvHash = await getUserPasswordHash(username);
    if (await compare(password, kvHash)) {
        console.log(`KV Authentication successful for user: ${username}`);
        return {
            isAuthenticated: true,
            isAdmin: username === envAdmin,
            username: username
        };
    }

    console.log(`User not found: ${username}`);
    return { isAuthenticated: false, isAdmin: false, username: null };
}