import "https://deno.land/x/dotenv/load.ts";
import { Eta } from "https://deno.land/x/eta/src/index.ts";
import { retrieveResultMetadata, retrieveResultsByUser } from "../lib/apps.ts";
import { downloadResult } from "../lib/file-storage.ts";

import { JSDOM } from 'npm:jsdom';
import DOMPurify from 'npm:dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

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

    const sanitizeOptions = {
        ALLOWED_URI_REGEXP: /^(?:(?:ftp|http|https|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    };


    for (const group of result.groups) {

        if (group.type === "text" || group.type === "static") {

            const replacedIMGresult = replaceSrcAttributes(group, result.groups)

            group.resultHTML = purify.sanitize(replacedIMGresult, sanitizeOptions)

            group.resultText = purify.sanitize(replacedIMGresult, sanitizeOptions)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    }


    ctx.response.body = eta.render('result', result);
}

function replaceSrcAttributes(group, groups) {

    // match img tags with data-group-reference attribute
    // using a capture group to use the name

    const imgPattern = /<img[^>]*data-group-reference="([^"]+)"[^>]*>/g;

    return group.result.replace(imgPattern, (match: string, resultReference: string) => {

        const correspondingGroup = groups.find(group => group.name === resultReference);

        if (correspondingGroup) {

            const srcAttributePattern = /src="[^"]*"/;

            return match.replace(srcAttributePattern, `src="data:image/jpeg;base64,${correspondingGroup.result}"`);
        }
        return match; // If no corresponding group is found, return the match unchanged
    });
}


async function renderUserResults(ctx) {
    const user = ctx.state.user;

    // console.log(ctx.state)

    if (!user.username) {
        ctx.response.status = 400;
        ctx.response.body = "No user";
        return;
    }

    const resultsMetadata = await retrieveResultsByUser(user.username);

    // console.log("[User results]", resultsMetadata);

    if (!resultsMetadata) {
        ctx.response.status = 404;
        ctx.response.body = ("No metadata found for this result");
        return;
    }

    ctx.response.headers.set("content-type", "text/html; charset=utf-8");

    ctx.response.body = eta.render('results', { results: resultsMetadata });
}
