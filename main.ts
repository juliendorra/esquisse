import { serve } from "https://deno.land/std/http/server.ts";
import { basicAuth } from "./lib/auth.ts";
import { contentType } from "https://deno.land/std/media_types/mod.ts";
import { tryGenerate as callStability } from "./lib/stability.js";
import { callGPT } from "./lib/gpt.js";
import { storeGroups, retrieveLatestAppVersion, retrieveMultipleLastAppVersions, checkAppIdExists, storeResults, retrieveResults, checkAppIsByUser } from "./lib/kv-storage.ts";
import { customAlphabet } from 'npm:nanoid';
import { decode } from "https://deno.land/x/imagescript/mod.ts";
import { bulkCreateUsers, listUsers } from "./lib/users.ts";

// 2 Billions IDs needed in order to have a 1% probability of at least one collision.
const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
const nanoid = customAlphabet(alphabet, 14);

const handler = async (request: Request): Promise<Response> => {

  const url = new URL(request.url);
  const { pathname } = url;

  const { isAuthenticated, isAdmin, username } = await basicAuth(request);

  const nanoidRegex = /^\/app\/[123456789bcdfghjkmnpqrstvwxyz]{14}$/;

  if (!pathname.startsWith("/public/")) {

    if (!isAuthenticated || !username) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Esquisse"', } });
    }
  }

  // triage calls that returns JSON
  if (pathname === ("/stability") || pathname === ("/chatgpt") || pathname === ("/load") || pathname === ("/load-result")) {
    return await handleJsonEndpoints(request);
  }

  else if (pathname === '/persist' && request.method === 'POST') {

    const body = await request.json();
    let appid = body.id;
    const timestamp = new Date().toISOString();

    if (!appid) {
      appid = nanoid(); //=> "f1q6jhnnvfmgxx"
    }
    else if (!await checkAppIdExists(appid)) {
      return new Response('Not Found, wrong ID', { status: 404 });
    }

    if (!(await checkAppIsByUser(appid, username))) {
      appid = nanoid(); // Generate new ID if the existing ID belongs to another user
    }

    let groups = body.groups;
    groups.appid = appid;
    groups.timestamp = timestamp;
    groups.username = username;

    console.log(groups);

    await storeGroups(groups);

    return new Response(JSON.stringify({ id: appid, username: username }), { headers: { 'Content-Type': 'application/json' } });
  }

  else if (pathname === "/persist-results" && request.method === "POST") {

    const body = await request.json();
    const resultid = nanoid();
    const timestamp = new Date().toISOString();

    const resultsData = { ...body, timestamp, resultid };

    await storeResults(resultsData);

    return new Response("Results stored successfully", { status: 200 });
  }

  // Admin endpoints

  else if (pathname === "/list-users" && request.method === "GET") {

    if (!isAdmin) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Esquisse"', } });
    }

    console.log("Listing users");

    const userList = await listUsers();

    return new Response(
      JSON.stringify(userList),
      { headers: { "content-type": "application/json" }, });
  }

  else if (pathname === "/bulk-create-users" && request.method === "POST") {

    if (!isAdmin) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Esquisse"', } });
    }

    const body = await request.json();

    console.log("Bulk creating users");

    const userList = await bulkCreateUsers(body);

    return new Response(
      JSON.stringify(userList),
      { headers: { "content-type": "application/json" }, });
  }

  // End admin endpoints


  else if (nanoidRegex.test(pathname) && request.method === 'GET') {
    const file = await Deno.readFile(`./static/index.html`);
    const type = contentType("html") || "text/plain";
    return new Response(file, {
      headers: { "content-type": type },
    });
  }

  else if (pathname === "/") {
    const file = await Deno.readFile(`./static/index.html`);
    const type = contentType("html") || "text/plain";
    return new Response(file, {
      headers: { "content-type": type },
    });
  }

  // Fall back to serving static files
  try {
    const file = await Deno.readFile(`./static${pathname}`);
    const type = contentType(pathname.slice(pathname.lastIndexOf(".") + 1)) || "text/plain";
    return new Response(file, {
      headers: { "content-type": type },
    });
  } catch (e) {
    return new Response('Not Found', { status: 404 });
  }

};

async function handleJsonEndpoints(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  let response;

  const body = await request.json();

  console.log(body);

  if (pathname === '/load' && request.method === 'POST') {

    console.log("Loading groups from KV");

    const id = body.id;
    const groups = await retrieveLatestAppVersion(id);

    if (groups) {
      return new Response(
        JSON.stringify(groups),
        { headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  else if (pathname === "/load-result" && request.method === 'POST') {
    const resultid = body.resultid;

    if (!resultid) {
      return new Response("resultid is required", { status: 400 });
    }

    const results = await retrieveResults(resultid);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  else if (pathname.startsWith("/stability") && request.method === 'POST') {
    // may return undefined
    let PNGimage = await callStability(
      body.data + " " + body.transform,
      "",
      "",
      body.qualityEnabled,
      3);

    if (PNGimage) {

      // compressing the PNG received from stability into a HQ JPEG to limit bandwidth
      // the PNG is an ArrayBuffer, we create an Uint8Array for manipulation
      let image = await decode(new Uint8Array(PNGimage));

      let jpegData = await image.encodeJPEG(90);

      const jpegResponse = new Response(
        jpegData,
        {
          headers: { "content-type": "image/jpeg" }
        });

      return jpegResponse;
    }
  }

  else if (pathname.startsWith("/chatgpt") && request.method === 'POST') {
    response = await callGPT(
      body.data,
      body.transform,
      body.qualityEnabled);

    return new Response(
      JSON.stringify(response),
      { headers: { "content-type": "application/json" }, });
  }
}

const port = 8080;
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await serve(handler, { port: +(Deno.env.get("PORT") ?? 8000) });
