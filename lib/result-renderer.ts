import "https://deno.land/x/dotenv/load.ts";
import { Eta } from "https://deno.land/x/eta/src/index.ts";

const S3_PROTOCOL = Deno.env.get("S3_PROTOCOL") || "https://"
const S3_ENDPOINT = Deno.env.get("S3_ENDPOINT");
const S3_BUCKET = Deno.env.get("S3_BUCKET");

let viewpath = Deno.cwd() + '/views/'
let eta = new Eta({ views: viewpath, cache: false, debug: true })

export { renderResult }

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

    const key = `${id}.json`;
    const resultUrl = `${S3_PROTOCOL}${S3_ENDPOINT}/${S3_BUCKET}/${key}`;

    console.log("[RESULT] fetching json from ", resultUrl)

    let result: any;

    try {
        const response = await fetch(resultUrl);

        if (!response.ok) {
            throw { response };
        }

        const json = await response.json();

        result = json;

    }
    catch (error) {
        console.error("[RESULT] Error loading results", error);

        ctx.response.status = error.response.status;
        ctx.response.body = await error.response;
        return;
    }

    ctx.response.headers.set("content-type", "text/html; charset=utf-8");

    result.GROUP_HTML = GROUP_HTML;

    ctx.response.body = eta.render('result', result);
}

