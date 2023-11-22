import { serve } from "https://deno.land/std/http/server.ts";
import { basicAuth } from "./auth.ts";
import { contentType } from "https://deno.land/std/media_types/mod.ts";
import { tryGenerate as callStability } from "./stability.js";
import { callGPT } from "./gpt.js";
import { storeGroups, retrieveGroups, checkIdExists } from "./kv-storage.ts";
import { customAlphabet } from 'npm:nanoid';

// 2 Billions IDs needed in order to have a 1% probability of at least one collision.
const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
const nanoid = customAlphabet(alphabet, 14);

const handler = async (request: Request): Promise<Response> => {

  const url = new URL(request.url);
  const { pathname } = url;

  const isAuthenticated = await basicAuth(request);

  const nanoidRegex = /^\/app\/[123456789bcdfghjkmnpqrstvwxyz]{14}$/;

  if (!pathname.startsWith("/public/")) {

    if (!isAuthenticated) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Esquisse"', } });
    }
  }

  // triage calls that returns JSON
  if (pathname.startsWith("/stability") || pathname.startsWith("/chatgpt") || url.pathname.startsWith("/load")) {
    return await handleJsonEndpoints(request);
  }

  else if (pathname === '/persist' && request.method === 'POST') {
    const body = await request.json();
    let id = body.id;

    if (!id) {
      id = nanoid(); //=> "f1q6jhnnvfmgxx"
    } else if (!await checkIdExists(id)) {
      return new Response('Not Found, wrong ID', { status: 404 });
    }

    await storeGroups(id, body.groups);
    return new Response(JSON.stringify({ id }), { headers: { 'Content-Type': 'application/json' } });
  }


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
    const groups = await retrieveGroups(id);

    if (groups) {
      return new Response(
        JSON.stringify(groups),
        { headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  if (pathname.startsWith("/stability")) {
    response = await callStability(
      body.data + " " + body.transform,
      "",
      "",
      body.qualityEnabled,
      3);

    return new Response(
      response,
      { headers: { "content-type": "image/png" }, });
  }

  if (pathname.startsWith("/chatgpt")) {
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
