import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { ensureDirSync } from "https://deno.land/std/fs/ensure_dir.ts";
import { join } from "https://deno.land/std/path/mod.ts";

const LOCAL_STORAGE_DIR = "./local-s3-storage";

ensureDirSync(LOCAL_STORAGE_DIR);

async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const key = url.pathname.substring(1); // Get key from the URL path

    // The bucket name is expected to be the first part of the path
    const [bucket, ...objectKeyParts] = key.split("/");
    const objectKey = objectKeyParts.join("/");

    if (!bucket || !objectKey) {
        return new Response("Invalid bucket or object key", { status: 400 });
    }

    const fullPath = join(bucket, objectKey);

    switch (req.method) {
        case "PUT":
            {
                const body = await req.arrayBuffer();
                await putObject(fullPath, new Uint8Array(body));
                return new Response(JSON.stringify({ key: fullPath }), { status: 200 });
            }

        case "GET":
            try {
                const data = await getObject(fullPath);
                return new Response(data, { status: 200 });
            } catch (error) {
                console.error("[MOCK S3]", error);
                return new Response("Object not found", { status: 404 });
            }

        case "HEAD":
            {
                const exists = await objectExists(fullPath);
                return new Response(null, { status: exists ? 200 : 404 });
            }
        default:
            return new Response("Method not allowed", { status: 405 });
    }
}

async function putObject(key: string, data: Uint8Array) {
    const filePath = join(LOCAL_STORAGE_DIR, key);
    ensureDirSync(join(LOCAL_STORAGE_DIR, key.split("/").slice(0, -1).join("/"))); // Ensure the directory exists
    await Deno.writeFile(filePath, data);
}

async function getObject(key: string): Promise<Uint8Array> {
    const filePath = join(LOCAL_STORAGE_DIR, key);
    if (!existsSync(filePath)) {
        throw new Error("Object not found");
    }
    return await Deno.readFile(filePath);
}

async function objectExists(key: string): Promise<boolean> {
    const filePath = join(LOCAL_STORAGE_DIR, key);
    return existsSync(filePath);
}

console.log("Mock S3 server running on http://localhost:443");

Deno.serve({ port: 443 }, handleRequest);