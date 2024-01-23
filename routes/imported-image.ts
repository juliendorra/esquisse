import "https://deno.land/x/dotenv/load.ts";
import { downloadImage } from "../lib/file-storage.ts";


export async function serveImportedImage(ctx) {
    const hash = ctx.params.hash;

    console.log(hash)

    if (!hash) {
        ctx.response.status = 400;
        ctx.response.body = "image hash is required";
        return;
    }

    // test if hash pattern //

    const downloadResponse = await downloadImage(hash)

    if (!downloadResponse) {
        ctx.response.status = 404;
        ctx.response.body = ("No file found for this result");
        return;
    }

    const result = await downloadResponse.arrayBuffer();

    ctx.response.headers.set("content-type", "image/jpeg");

    ctx.response.body = result;
}

