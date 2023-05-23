import { serve } from "https://deno.land/std/http/server.ts";
import { tryGenerate as callStability } from "./stability.js";
import { callGPT } from "./gpt.js";

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith("/stability") || pathname.startsWith("/chatgpt")) {
    return await handleJsonEndpoints(request);
  }

  // Fall back to serving static files
  try {
    const file = await Deno.readFile(`./static${pathname}`);
    return new Response(file);
  } catch (e) {
    return new Response('Not Found', { status: 404 });
  }
};

async function handleJsonEndpoints(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  let response;

  const body = await request.json();

  if (pathname.startsWith("/stability")) {
    response = callStability(body);
  }

  if (pathname.startsWith("/chatgpt")) {
    response = callGPT(body);
  }

  return new Response(JSON.stringify(response), {
    headers: { "content-type": "application/json" },
  });
}

const port = 8080;
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await serve(handler, { port: +(Deno.env.get("PORT") ?? 8000) });
