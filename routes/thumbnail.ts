import "https://deno.land/x/dotenv/load.ts";
import { retrieveResultMetadata } from "../lib/apps.ts";
import { downloadImage } from "../lib/file-storage.ts";


export async function serveThumbnail(ctx) {
    const id = ctx.params.id;

    if (!id) {
        ctx.response.status = 400;
        ctx.response.body = "id is required";
        return;
    }

    const resultMetadata = await retrieveResultMetadata(id);

    if (!resultMetadata) {
        ctx.response.status = 404;
        ctx.response.body = ("No metadata found for this result");
        return;
    }

    // this id is the ulid key of the result data in kv, not the public sharing resultid
    const downloadResponse = await downloadImage(resultMetadata.id)

    if (!downloadResponse) {
        ctx.response.status = 404;
        ctx.response.body = ("No file found for this result");
        return;
    }

    const result = await downloadResponse.arrayBuffer();

    ctx.response.headers.set("content-type", "image/jpeg");

    ctx.response.body = result;
}

