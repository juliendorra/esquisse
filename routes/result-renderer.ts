import "https://deno.land/x/dotenv/load.ts";
import { Eta } from "https://deno.land/x/eta/src/index.ts";
import { retrieveResultMetadata, retrieveResultsByUser } from "../lib/apps.ts";
import { downloadResult } from "../lib/file-storage.ts";

let viewpath = Deno.cwd() + '/views/'
let eta = new Eta({ views: viewpath, cache: false, debug: true })

export { renderResult, renderUserResults }

const GROUP_HTML = {
    BREAK: `
    <div class="group break">
        <div class="group-header">
            <small><img src="/icons/break.svg"></small>
        </div>
    `,

    STATIC: `
    <div class="group static">
        <div class="group-header">
            <small><img src="/icons/text-static.svg"></small>
        </div>
    `,

    IMPORTED_IMAGE: `
    <div class="group imported-image"">
        <div class="group-header">
            <small><img src="/icons/imported-image.svg"></small>
        </div>
    `,

    TEXT: `
    <div class="group text">
        <div class="group-header">
            <small><img src="/icons/text-gen.svg"></small>
        </div>
    `,

    IMAGE: `
    <div class="group image">
        <div class="group-header">
            <small><img src="/icons/image-gen.svg"></small>
        </div>
    `,
};


async function renderResult(ctx) {
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
    const downloadResponse = await downloadResult(resultMetadata.id)

    if (!downloadResponse) {
        ctx.response.status = 404;
        ctx.response.body = ("No file found for this result");
        return;
    }

    const result = await downloadResponse.json();

    ctx.response.headers.set("content-type", "text/html; charset=utf-8");

    result.GROUP_HTML = GROUP_HTML;

    ctx.response.body = eta.render('result', result);
}


async function renderUserResults(ctx) {
    const user = ctx.state.user;

    console.log(ctx.state)

    if (!user.username) {
        ctx.response.status = 400;
        ctx.response.body = "No user";
        return;
    }

    const resultsMetadata = await retrieveResultsByUser(user.username);

    console.log("[User results]", resultsMetadata);

    if (!resultsMetadata) {
        ctx.response.status = 404;
        ctx.response.body = ("No metadata found for this result");
        return;
    }

    ctx.response.headers.set("content-type", "text/html; charset=utf-8");

    ctx.response.body = eta.render('results', { results: resultsMetadata });
}
