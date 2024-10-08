import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { factory } from "https://deno.land/x/oak/middleware/etag.ts";
import { basicAuth } from "./lib/auth.ts";
import {
  handleStability, handleChatGPT,
  handleLoad, handleLoadVersion, handleLoadVersions,
  handleLoadResult,
  handlePersist, handlePersistImage,
  handleClone,
  handleRecover,
  handlePersistResult, handleListApps,
  handleListResults,
  handleListUsers, handleBulkCreateUsers
} from './routes/api.ts';
import { handleUserFacingURLs, handleStaticFiles } from './routes/user-facing-and-static.ts';
import { renderResult, renderUserResults } from "./routes/result-renderer.ts";
import { renderCommunity } from "./routes/community-renderer.ts"
import { serveThumbnail } from "./routes/thumbnail.ts";
import { serveImportedImage } from "./routes/imported-image.ts";
import { handleListUsedApps } from './routes/api.ts';
import { handleListMostUsedApps, handleListLastActiveUsers, handleListMostActiveUsers } from './routes/dashboard.ts';


const router = new Router();

// JSON Endpoints
router
  .post('/stability', handleStability)
  .post('/chatgpt', handleChatGPT)
  .post('/persist-image', handlePersistImage)
  .post('/persist-result', handlePersistResult)
  .post('/persist', handlePersist)
  .post('/clone', handleClone)
  .post('/recover', handleRecover)
  .post('/list-apps', handleListApps)
  .get('/list-used-apps', handleListUsedApps)
  .get('/list-results', handleListResults)
  .post('/load-versions', handleLoadVersions)
  .post('/load-version', handleLoadVersion)
  .post('/load-result', handleLoadResult)
  .post('/load', handleLoad)
  ;

// Dashboard routes
router
  .get('/list-most-used-apps', handleListMostUsedApps)
  .get('/list-last-active-users', handleListLastActiveUsers)
  .get('/list-most-active-users', handleListMostActiveUsers)
  .get('/dashboard', handleUserFacingURLs)
  ;


// User Facing URLs
router
  .get('/app', handleUserFacingURLs)
  .get('/app/:id', handleUserFacingURLs)
  .get('/apps', handleUserFacingURLs)
  .get('/apps/:user', handleUserFacingURLs)
  .get('/community', renderCommunity)
  .get("/result/:id", renderResult)
  .get("/results", renderUserResults)
  .get("/thumbnail/:id", serveThumbnail)
  .get("/imported-image/:hash", serveImportedImage)
  .get('/admin', handleUserFacingURLs)
  .get('/', handleUserFacingURLs)
  ;

// Admin Endpoints
router
  .get('/list-users', handleListUsers)
  .post('/bulk-create-users', handleBulkCreateUsers);

const app = new Application();

// Authentication Middleware

const routePrefixes = [
  "/app", "/apps", "/imported-image",
];

const exactRoutes = [
  '/',
  '/stability', '/chatgpt',
  '/persist', '/persist-result', '/persist-image', '/clone', '/recover',
  '/load', '/load-version', '/load-versions', '/load-result',
  "/app", "/apps", "/list-apps", "/list-used-apps",
  "/community",
  "/results", '/list-results',
  "/admin", "/dashboard",
  "/list-users", "/bulk-create-users",
  "/list-most-used-apps", "/list-last-active-users", "/list-most-active-users",
];

app.use(async (ctx, next) => {

  const path = ctx.request.url.pathname;

  const isAuthRoute =
    routePrefixes.some(prefix => path.startsWith(prefix + "/"))
    || exactRoutes.some(route => path === route);

  if (isAuthRoute) {

    const authResult = await basicAuth(ctx.request);

    if (!authResult.isAuthenticated || !authResult.username) {
      ctx.response.status = 401;
      ctx.response.body = 'Unauthorized';
      ctx.response.headers.set('WWW-Authenticate', 'Basic realm="Esquisse"');
      return;
    }
    ctx.state.user = authResult; // { isAuthenticated,  isAdmin, username}

    // sending the authenticated username back to the client, as validation
    // needed as we use the browser basic auth, which keeps username out of JavaScript reach
    ctx.response.headers.set("X-username", authResult.username);
  }
  await next();
});

app.use(factory());
app.use(router.routes());
app.use(router.allowedMethods());


// Fallback Middleware for Static Files
app.use(async (ctx, next) => {
  const path = ctx.request.url.pathname;

  const isRoutePath =
    routePrefixes.some(prefix => path.startsWith(prefix + "/"))
    || exactRoutes.some(route => path === route);

  if (!isRoutePath) {
    await handleStaticFiles(ctx);
  } else {
    await next();
  }
});


app.addEventListener("error", (evt) => {
  console.error(evt.error);
});

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")) : 8000;

console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);

await app.listen({ port });

