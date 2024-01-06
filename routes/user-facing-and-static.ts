export { handleUserFacingURLs, handleStaticFiles }


// Handler for facing URLs like  '/', '/app[/id]', '/apps[/user]', and '/admin'
async function handleUserFacingURLs(ctx) {

    const pathname = ctx.request.url.pathname;

    console.log(pathname)

    if (pathname === "/" || pathname === ("/app") || pathname.startsWith("/app/")) {

        console.log(pathname);

        try {
            const filePath = 'index.html';
            await ctx.send({
                root: `${Deno.cwd()}/static`,
                index: 'index.html',
                path: filePath,
            });
        } catch {
            ctx.response.status = 404;
            ctx.response.body = 'URL not found';
        }
    }

    else if (pathname.startsWith("/apps")) {
        try {
            const filePath = 'apps.html';
            await ctx.send({
                root: `${Deno.cwd()}/static`,
                index: 'index.html',
                path: filePath,
            });
        } catch {
            ctx.response.status = 404;
            ctx.response.body = 'URL not found';
        }
    }

    else if (pathname.startsWith("/admin")) {
        if (!ctx.state.user.isAdmin) {
            ctx.response.status = 401;
            ctx.response.body = 'Unauthorized';
            ctx.response.headers.set('WWW-Authenticate', 'Basic realm="Esquisse"');
        }

        try {
            const filePath = 'admin.html';
            await ctx.send({
                root: `${Deno.cwd()}/static`,
                index: 'index.html',
                path: filePath,
            });
        } catch {
            ctx.response.status = 404;
            ctx.response.body = 'URL not found';
        }
    }

    else {

        ctx.response.status = 404;
        ctx.response.body = 'URL not found';
    }
}

// Handler for serving static files
async function handleStaticFiles(ctx) {

    console.log("STATIC FILE", `${Deno.cwd()}/static${ctx.request.url.pathname}`)

    try {
        const filePath = `${ctx.request.url.pathname}`;
        await ctx.send({
            root: `${Deno.cwd()}/static`,
            index: 'index.html',
            path: filePath,
        });
    } catch {
        ctx.response.status = 404;
        ctx.response.body = 'URL not found';
    }

}

