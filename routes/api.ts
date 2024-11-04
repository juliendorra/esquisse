import { decode } from "https://deno.land/x/imagescript/mod.ts";
import { customAlphabet } from 'npm:nanoid';
import { Validator } from "npm:jsonschema";

import { base64ToUint8Array } from "../lib/utility.ts";

import { tryGenerate as callImageGen } from "../lib/imagegen.ts";
import { callGPT } from "../lib/gpt.js";
import { bulkCreateUsers, listUsers } from "../lib/users.ts";
import { downloadResult, uploadResult, uploadImage } from "../lib/file-storage.ts";
import {
    storeApp,
    retrieveLatestAppVersion, retrieveMultipleLastAppVersions, retrieveAppVersion, checkAppIdExists,
    storeResultMetadata, retrieveResultMetadata,
    checkAppIsByUser, retrieveAppsByUser, retrieveResultsByUser
} from "../lib/apps.ts";
import { addUsageEntry, listLastUsagesByUser } from "../lib/usage.ts";
import { packageAppList } from "../lib/package-app-list.ts";
import { blobToFullHash } from "../lib/utility.ts";

export {
    handleStability, handleChatGPT,
    handleLoad, handleLoadVersion, handleLoadVersions,
    handleLoadResult,
    handlePersist, handlePersistImage,
    handleClone,
    handleRecover,
    handlePersistResult, handleListApps,
    handleListResults,
    handleListUsers, handleBulkCreateUsers,
    handleListUsedApps,
}

// Constants and utilities
const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
const nanoidForApp = customAlphabet(alphabet, 14);
const nanoidForResult = customAlphabet(alphabet, 17);

// Types
type ResultSummary = { generatedtitle: string, generatedsummary: string }

// Handler functions

// Handler for '/stability' endpoint
async function handleStability(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    // return either {error} or {image}

    // the image property is expected as a base64 encoded image, 

    type ImageGenParameters = {
        prompt: string,
        negativeprompt: string,
        image?: string,
        format: string,
        qualityEnabled: boolean,
        controlnetEnabled: boolean,
        maxAttempts: number,
    }

    const imageGenParameters: ImageGenParameters = {
        prompt: body.data + " " + body.transform,
        negativeprompt: "",
        format: "",
        qualityEnabled: body.qualityEnabled,
        controlnetEnabled: body.controlnetEnabled,
        maxAttempts: 3
    };

    if (body.image) {
        imageGenParameters.image = body.image;
    }

    let generated = await callImageGen(imageGenParameters);

    if (generated.image) {

        // compressing the PNG received from stability into a HQ JPEG to limit bandwidth
        // the PNG is an ArrayBuffer, we create an Uint8Array for manipulation
        let image = await decode(new Uint8Array(generated.image));

        let jpegData = await image.encodeJPEG(90);

        ctx.response.headers.set("content-type", "image/jpeg");

        if (generated.bannedword) {
            ctx.response.headers.set("X-Banned-Word", generated.bannedword);
        }

        ctx.response.body = jpegData;

        if (body.appid) {
            await addUsageEntry({
                timestamp: new Date().toISOString(),
                username: ctx.state.user.username,
                appid: body.appid,
                endpoint: '/stability',
                type: 'IMAGE'
            });
        }
        return;
    }
    else {
        ctx.response.status = 400;
        ctx.response.body = JSON.stringify({ error: generated.error });
        return;
    }
}

// Handler for '/chatgpt' endpoint
async function handleChatGPT(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    type GptParameters = {
        data: string,
        image: string | undefined,
        transform: string,
        qualityEnabled: boolean,
    }

    const gptParameters: GptParameters = {
        data: body.data,
        image: undefined,
        transform: body.transform,
        qualityEnabled: body.qualityEnabled
    };

    if (body.image) {
        gptParameters.image = body.image;
    }

    const response = await callGPT(gptParameters);

    ctx.response.body = JSON.stringify(response);

    if (body.appid) {
        await addUsageEntry({
            timestamp: new Date().toISOString(),
            username: ctx.state.user.username,
            appid: body.appid,
            endpoint: '/chatgpt',
            type: 'TEXT'
        });
    }

    return;
}

// Handler for '/load' endpoint
async function handleLoad(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    const id = body.id;

    // console.log("Loading groups from KV: ", body);

    //  {type,timestamp,value:{versiongroups,appid,timestamp,username}}
    const groups = await retrieveLatestAppVersion(id);

    if (groups) {
        ctx.response.body = JSON.stringify(groups);
        return;
    } else {
        ctx.response.status = 404;
        ctx.response.body = 'App not found';
        return;
    }
}

// Handler for '/load-version' endpoint
async function handleLoadVersion(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    console.log("Loading versions of app from KV");

    const id = body.id;
    const appversiontimestamp = body.appversiontimestamp;

    // {type,timestamp,value:{versiongroups,appid,timestamp,username}}
    let appversion;

    if (id && appversiontimestamp) {
        appversion = await retrieveAppVersion(id, appversiontimestamp);
    }
    else {
        ctx.response.status = 400;
        ctx.response.body = 'Missing id and/or appversiontimestamp fields';
        return;
    }

    if (appversion) {
        ctx.response.body = JSON.stringify(appversion);
        return;

    } else {
        ctx.response.status = 404;
        ctx.response.body = 'App not found';
        return;
    }
}

// Handler for '/load-versions' endpoint
async function handleLoadVersions(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    console.log("Loading versions of app from KV");

    const id = body.id;
    const limit = body.limit;

    // [{type,timestamp,value:{versiongroups,appid,timestamp,username}}, ...]
    let appversions;

    if (id && limit) {
        appversions = await retrieveMultipleLastAppVersions(id, limit);
    }
    else {
        ctx.response.status = 400;
        ctx.response.body = 'Missing id and/or limit fields';
        return;
    }

    if (appversions.length > 0) {
        ctx.response.body = JSON.stringify(appversions);
        return;

    } else {
        ctx.response.status = 404;
        ctx.response.body = 'App not found';
        return;
    }
}

// Handler for '/load-result' endpoint
async function handleLoadResult(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    const resultid = body.resultid;

    if (!resultid) {
        ctx.response.status = 400;
        ctx.response.body = "resultid is required";
        return;
    }

    const resultMetadata = await retrieveResultMetadata(resultid);

    if (!resultMetadata) {
        ctx.response.status = 404;
        ctx.response.body = ("No metadata found for this result");
        return;
    }

    const downloadResponse = await downloadResult(resultMetadata.id)

    if (!downloadResponse) {
        ctx.response.status = 404;
        ctx.response.body = ("No file found for this result");
        return;
    }

    ctx.response.body = downloadResponse.body;
}

// Handler for '/persist' endpoint
async function handlePersist(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    console.log("body for groups to persist", body)

    const username = ctx.state.user?.username;

    let appid = body.id;
    const timestamp = new Date().toISOString();

    if (!appid) {
        appid = nanoidForApp(); //=> "f1q6jhnnvfmgxx"
    }
    else if (!await checkAppIdExists(appid)) {
        ctx.response.status = 404;
        ctx.response.body = 'Not Found, wrong ID';
        return;
    }

    const appIsByCurrentUser = await checkAppIsByUser(appid, username);

    if (!appIsByCurrentUser && body.groups.groups.length === 0) {
        ctx.response.status = 403;
        ctx.response.body = ("Cannot persist an empty app that the user didn't created");
        return;
    }

    if (!appIsByCurrentUser) {
        appid = nanoidForApp(); // Generate new ID if the existing ID belongs to another user
    }

    let groups = body.groups;
    groups.appid = appid;
    groups.timestamp = timestamp;
    groups.username = username;

    console.log("App data to store: ", groups);

    await storeApp(groups);

    ctx.response.body = JSON.stringify({ id: appid, username: username });
}

async function handlePersistImage(ctx) {

    const requestBody = ctx.request.body;
    const imageMessage = await requestBody.json();

    if (!imageMessage.image) {
        ctx.response.status = 400;
        ctx.response.body = ("Missing image");
        return;
    }

    const imageIsJpeg = imageMessage.image && imageMessage.image.startsWith("/9j/");

    if (!imageIsJpeg) {
        ctx.response.status = 400;
        ctx.response.body = ("No valid image");
        return;
    }

    const imageUint8Array = base64ToUint8Array(imageMessage.image);

    const imageFile = new File([imageUint8Array], 'image.jpeg', { type: 'image/jpeg' })

    const imageHash = await blobToFullHash(imageFile);

    console.log(`[PERSIST IMAGE] image hash: ${imageHash}`)


    const uploadImageStatus = await uploadImage(imageUint8Array, imageHash)

    if (!uploadImageStatus.success) {
        ctx.response.status = 400;
        ctx.response.body = ("Image upload failed");
        return;
    }

    console.log(`[PERSIST IMAGE] image saved with hash id: ${imageHash} available at `, uploadImageStatus.url)

    ctx.response.status = 200;
    ctx.response.body = { imageHash: imageHash };
}

// Handler for '/clone' endpoint
async function handleClone(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    const username = ctx.state.user?.username;

    let appid = body.id;
    const timestamp = new Date().toISOString();

    if (!appid) {
        ctx.response.status = 404;
        ctx.response.body = 'No ID. Need an app ID to clone app';
        return;
    }
    else if (!await checkAppIdExists(appid)) {
        ctx.response.status = 404;
        ctx.response.body = 'No app Found, wrong ID';
        return;
    }

    const appIsByCurrentUser = await checkAppIsByUser(appid, username);

    if (!appIsByCurrentUser) {
        ctx.response.status = 403;
        ctx.response.body = ("Cannot clone an app that the user didn't created");
        return;
    }

    const cloneappid = nanoidForApp(); // Generate new ID for the cloned app

    const version = await retrieveLatestAppVersion(appid);

    if (!version) {
        ctx.response.status = 404;
        ctx.response.body = 'Failed to retrieve app data';
        return;
    }

    const groups = version.value;

    groups.appid = cloneappid;
    groups.timestamp = timestamp;
    groups.username = username;

    console.log("App data to store: ", groups);

    await storeApp(groups);

    ctx.response.body = JSON.stringify({ id: appid, username: username });
}
// Handler for '/recover' endpoint
async function handleRecover(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    const username = ctx.state.user?.username;

    let appid = body.id;
    const timestamp = new Date().toISOString();

    if (!appid) {
        ctx.response.status = 404;
        ctx.response.body = 'No ID. Need an app ID to recover app';
        return;
    }
    else if (!await checkAppIdExists(appid)) {
        ctx.response.status = 404;
        ctx.response.body = 'No app Found, wrong ID';
        return;
    }

    const appIsByCurrentUser = await checkAppIsByUser(appid, username);

    if (!appIsByCurrentUser) {
        ctx.response.status = 403;
        ctx.response.body = ("Cannot recover an app that the user didn't created");
        return;
    }

    let groups;

    const versions = await retrieveMultipleLastAppVersions(appid, 10);
    if (versions) {
        for (const version of versions) {
            if (version.value.groups.length > 0) {
                // we found a non-empty version, let's use that
                groups = version.value.groups;
                break;
            }
        }
    }

    if (!groups) {
        ctx.response.status = 404;
        ctx.response.body = 'Failed to retrieve non-empty app groups data';
        return;
    }
    let app = {
        appid: appid,
        timestamp: timestamp,
        username: username,
        groups: groups,
    }

    console.log("App data to store: ", app);

    await storeApp(app);

    ctx.response.body = JSON.stringify({ id: appid, username: username });
}

// Handler for '/persist-result' endpoint
async function handlePersistResult(ctx) {

    const appIdPattern = /^[123456789bcdfghjkmnpqrstvwxyz]{14}$/;

    const requestBody = ctx.request.body;
    const resultData = await requestBody.json();

    if (!resultData.appid) {
        ctx.response.status = 400;
        ctx.response.body = ("Missing app id");
        return;
    }

    if (!appIdPattern.test(resultData.appid)) {
        ctx.response.status = 400;
        ctx.response.body = ("Invalid app id");
        return;
    }

    resultData.resultid = nanoidForResult();
    resultData.timestamp = new Date().toISOString();
    resultData.username = ctx.state.user.username;

    const { generatedtitle, generatedsummary } = await generateTitleAndSummary(resultData);

    resultData.generatedtitle = generatedtitle;
    resultData.generatedsummary = generatedsummary;

    const metadata = {
        resultid: resultData.resultid,

        username: resultData.username,
        timestamp: resultData.timestamp,
        appid: resultData.appid,
        appversiontimestamp: resultData.appversiontimestamp,

        name: resultData.name,
        snippet: resultData.snippet,

        generatedtitle: resultData.generatedtitle,
        generatedsummary: resultData.generatedsummary,
    }

    const storingStatus = await storeResultMetadata(metadata);

    if (!storingStatus.ok) {
        ctx.response.status = 400;
        ctx.response.body = ("Result metadata storing failed");
        return;
    }

    const uploadStatus = await uploadResult(resultData, storingStatus.id)

    if (!uploadStatus.success) {

        ctx.response.status = 400;
        ctx.response.body = ("Result upload failed");
        return;
    }

    console.log(`[RESULT] metadate saved result id ${metadata.resultid} available at `, uploadStatus.url)

    console.log(resultData)

    const thumbnailIsJpeg = resultData.thumbnail && resultData.thumbnail.startsWith("/9j/");

    if (!thumbnailIsJpeg) {
        ctx.response.status = 400;
        ctx.response.body = ("No valid thumbnail");
        return;
    }

    const uploadImageStatus = await uploadImage(
        base64ToUint8Array(resultData.thumbnail),
        storingStatus.id)

    if (!uploadStatus.success) {

        ctx.response.status = 400;
        ctx.response.body = ("Thumbnail upload failed");
        return;
    }

    console.log(`[RESULT] thumbnail saved result id ${metadata.resultid} available at `, uploadImageStatus.url)

    ctx.response.status = 200;
    ctx.response.body = {
        resultid: resultData.resultid,
        generatedtitle: resultData.generatedtitle,
        generatedsummary: resultData.generatedsummary
    };
}

// Handler for '/list-apps' endpoint
async function handleListApps(ctx) {

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    const username = ctx.state.user?.username;
    let targetUsername = body.username?.toLowerCase().trim();

    if (!targetUsername) {
        targetUsername = username;
    }

    const apps = await retrieveAppsByUser(targetUsername);

    let allApps = await packageAppList(apps, username, targetUsername);

    ctx.response.body = JSON.stringify(
        {
            currentuser: username,
            appscreator: targetUsername,
            apps: allApps,
        }
    );
}


// Handler for '/list-results' endpoint
async function handleListResults(ctx) {

    const user = ctx.state.user;

    // console.log(ctx.state)

    if (!user.username) {
        ctx.response.status = 400;
        ctx.response.body = "No user";
        return;
    }

    const resultsMetadata = await retrieveResultsByUser(user.username);

    if (!resultsMetadata) {
        ctx.response.status = 404;
        ctx.response.body = ("No metadata found for this result");
        return;
    }

    ctx.response.body = JSON.stringify(resultsMetadata);
}

// Handler for '/list-users' endpoint
async function handleListUsers(ctx) {

    if (!ctx.state.user.isAdmin) {
        ctx.response.status = 401;
        ctx.response.headers.set('WWW-Authenticate', 'Basic realm="Esquisse"');
        ctx.response.body = 'Unauthorized';
        return;
    }

    console.log("Listing users");

    const userList = await listUsers();

    ctx.response.body = JSON.stringify(userList);
}

// Handler for '/bulk-create-users' endpoint
async function handleBulkCreateUsers(ctx) {

    if (!ctx.state.user.isAdmin) {
        return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Esquisse"', } });
    }

    const requestBody = ctx.request.body;
    const body = await requestBody.json();

    console.log("Bulk creating users");

    const userList = await bulkCreateUsers(body);

    ctx.response.body = JSON.stringify(userList);
}

async function handleListUsedApps(ctx) {

    const username = ctx.state.user?.username;

    const usages = await listLastUsagesByUser(username, 100);

    // Get unique app IDs from the usages, preserving order
    const uniqueAppIds = [...new Set(usages.map(usage => usage.appid))];

    const lastFiveUniqueAppIds = uniqueAppIds.slice(0, 5);

    // Retrieve app versions for the unique app IDs
    const usedApps = await Promise.all(
        lastFiveUniqueAppIds.map(async appId => {
            const appVersion = await retrieveLatestAppVersion(appId);
            return appVersion ? appVersion.value : null;
        })
    );

    // console.log("[List Used Apps], Used apps are ", usedApps);

    // [
    //     {
    //     "appid",
    //     "version",
    //     "timestamp",
    //     "username",
    //     "groups": [{id", "name","data","transform","type","interactionState","resultDisplayFormat"}, ...],
    //         },
    //     ...
    // ]

    // Filter out null values and package the app list
    let packagedAppList = await packageAppList(
        usedApps.filter(app => app !== null),
        username,
        username
    );

    ctx.response.body = JSON.stringify({
        currentuser: username,
        apps: packagedAppList,
    });
}

// Util

async function generateTitleAndSummary(result, maxAttempts = 3): Promise<ResultSummary> {

    const summarySchema = {
        type: "object",
        properties: {
            generatedtitle: { type: "string" },
            generatedsummary: { type: "string" },
        },
        required: ["generatedtitle", "generatedsummary"],
        additionalProperties: false
    };

    const prompt = `
This is a result from a generative AI tool where users build their own workflows, generate results and then can save a result to share it.

You have the result and a screenshot of the result that may show images generated as part of the result.

Create a title and summary of the content of this result. Focus on the specifics in the results, what might be different from other similar results that would use the same app. Don't focus on the overall structure or the generic workflow, but the specific use that have been done of the workflow. Focus on the results generated, not the titles of the groups, because the group's titles don't change from results to results. Use the screenshot to get a better sense of the images generated in the result.

Don't add meta-references or self-references like "this result is about…" or "The result shows". The summary should describe what is the result without mentioning that it is a result.

Write the summary and the title in the main language in which the result texts are written.

The title should be 50 characters maximum and reflect what is unique about this result. It should also be aligned with the summary yet still reflect the general content of the result.

The summary should be 140 characters and give an overview of the content of the result.

Return just a JSON : {generatedtitle, generatedsummary}
Don't use a codeblock, answer with just the json content.
`;

    const imagesStrippedResult = JSON.stringify(result)
        .replace(/\/9j\/[^"]*/g, '') // remove base64 image data
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/\n/g, '\\n')    // Escape newlines
        .replace(/\r/g, '\\r')    // Escape carriage returns
        .replace(/\t/g, '\\t')    // Escape tabs
        .replace(/"/g, '\\"');    // Escape double quotes

    const gptParameters = {
        data: prompt + "\n\n" + imagesStrippedResult,
        image: result.thumbnail,
        qualityEnabled: false, // fast mode is enough and preferred
    };

    console.log(gptParameters.data);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const summaryResponse = await callGPT(gptParameters);
        const summaryResult = JSON.parse(summaryResponse);

        const validator = new Validator();
        const validationResult = validator.validate(summaryResult, summarySchema);

        if (validationResult.valid) {
            return {
                generatedtitle: summaryResult.generatedtitle,
                generatedsummary: summaryResult.generatedsummary
            };
        }

        console.error(`Validation failed for summary result on attempt ${attempt + 1}:`, validationResult.errors);
    }

    console.error(`Failed to generate a valid title and summary after ${maxAttempts} attempts`);

    // rather than throwing an error, we return an empty result
    // the renderer will handle that by picking a non-generated replacement:
    // generatedtitle => name (of the app)
    // generatedsummary => snippet (first text content found in result)
    return { generatedtitle: "", generatedsummary: "" }
}