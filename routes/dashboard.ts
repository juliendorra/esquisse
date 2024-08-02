import { listMostUsedApps, listLastActiveUsers, listMostActiveUsers } from "../lib/usage.ts";
import { retrieveLatestAppVersion } from "../lib/apps.ts";

export async function handleListMostUsedApps(ctx) {
    try {
        const limit = 10; // Default limit, can be made configurable
        const mostUsedApps = await listMostUsedApps(limit);

        // Fetch additional app information for each app
        const appsWithDetails = await Promise.all(mostUsedApps.map(async (app) => {
            const appVersion = await retrieveLatestAppVersion(app.appid);
            return {
                ...app,
                name: appVersion?.value?.groups[0]?.name || 'Unnamed App',
                link: `/app/${app.appid}`
            };
        }));

        ctx.response.body = JSON.stringify(appsWithDetails);
    } catch (error) {
        console.error('Error in handleListMostUsedApps:', error);
        ctx.response.status = 500;
        ctx.response.body = 'Internal server error';
    }
}

export async function handleListLastActiveUsers(ctx) {
    try {
        const limit = 10; // Default limit, can be made configurable
        const lastActiveUsers = await listLastActiveUsers(limit);
        ctx.response.body = JSON.stringify(lastActiveUsers);
    } catch (error) {
        console.error('Error in handleListLastActiveUsers:', error);
        ctx.response.status = 500;
        ctx.response.body = 'Internal server error';
    }
}

export async function handleListMostActiveUsers(ctx) {
    try {
        const limit = 10; // Default limit, can be made configurable
        const mostActiveUsers = await listMostActiveUsers(limit);
        ctx.response.body = JSON.stringify(mostActiveUsers);
    } catch (error) {
        console.error('Error in handleListMostActiveUsers:', error);
        ctx.response.status = 500;
        ctx.response.body = 'Internal server error';
    }
}