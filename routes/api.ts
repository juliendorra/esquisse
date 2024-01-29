import { decode } from "https://deno.land/x/imagescript/mod.ts";
import { customAlphabet } from 'npm:nanoid';

import { base64ToUint8Array } from "../lib/utility.ts";

import { tryGenerate as callImageGen } from "../lib/imagegen.ts";
import { callGPT } from "../lib/gpt.js";
import { bulkCreateUsers, listUsers } from "../lib/users.ts";
import { downloadResult, uploadResult, uploadImage } from "../lib/file-storage.ts";
import {
    storeApp,
    retrieveLatestAppVersion, retrieveMultipleLastAppVersions, retrieveAppVersion, checkAppIdExists,
    storeResultMetadata, retrieveResultMetadata,
    checkAppIsByUser, retrieveAppsByUser,
} from "../lib/apps.ts";


export {
    handleStability, handleChatGPT,
    handleLoad, handleLoadVersion, handleLoadVersions,
    handleLoadResult,
    handlePersist, handlePersistImage,
    handlePersistResult, handleListApps,
    handleListUsers, handleBulkCreateUsers
}

// Constants and utilities
const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
const nanoidForApp = customAlphabet(alphabet, 14);
const nanoidForResult = customAlphabet(alphabet, 17);

// Handler functions

// Handler for '/stability' endpoint
async function handleStability(ctx) {

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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
    return;
}

// Handler for '/load' endpoint
async function handleLoad(ctx) {

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

    const id = body.id;

    console.log("Loading groups from KV: ", body);

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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

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

    if (!(await checkAppIsByUser(appid, username))) {
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

    const responseBody = ctx.request.body;
    const imageMessage = await responseBody.json();

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

// utils for handlePersistImage

async function blobToFullHash(blob: Blob): Promise<string> {
    const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
            } else {
                reject(new Error("Read result is not an ArrayBuffer"));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

    const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashBase64: string = bufferToBase64(hashBuffer);

    const urlSafeHash = hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return urlSafeHash;
}

function bufferToBase64(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer);
    const binaryString = Array.from(byteArray, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
}

// Handler for '/persist-result' endpoint
async function handlePersistResult(ctx) {

    const appIdPattern = /^[123456789bcdfghjkmnpqrstvwxyz]{14}$/;

    const responseBody = ctx.request.body;
    const resultData = await responseBody.json();

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

    const metadata = {
        resultid: resultData.resultid,

        username: resultData.username,
        timestamp: resultData.timestamp,

        appid: resultData.appid,
        appversiontimestamp: resultData.appversiontimestamp,
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
    ctx.response.body = { resultid: resultData.resultid };
}

// Handler for '/list-apps' endpoint
async function handleListApps(ctx) {

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

    const username = ctx.state.user?.username;
    let targetUsername = body.username?.toLowerCase().trim();

    if (!targetUsername) {
        targetUsername = username;
    }

    const apps = await retrieveAppsByUser(targetUsername);

    const appsInformations = apps.map(
        (app) => {

            const groupstypes = app.groups.map(group => group.type);

            // console.log(groupstypes);

            return {
                name: app.groups[0]?.name || 'Unnamed App', // Name from the first group's name
                appid: app.appid,
                link: `/app/${app.appid}`,
                groupstypes: groupstypes,
            };
        }
    );

    ctx.response.body = JSON.stringify(appsInformations);
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

    const responseBody = ctx.request.body;
    const body = await responseBody.json();

    console.log("Bulk creating users");

    const userList = await bulkCreateUsers(body);

    ctx.response.body = JSON.stringify(userList);
}
