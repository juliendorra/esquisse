import "https://deno.land/x/dotenv/load.ts";
import { Eta } from "https://deno.land/x/eta/src/index.ts";
import { listMostUsedApps, listLastActiveUsers, listMostActiveUsers } from "../lib/usage.ts";
import { packageAppList } from "../lib/package-app-list.ts";
import { retrieveLatestAppVersion } from "../lib/apps.ts";
import { listUsers } from "../lib/users.ts";

let viewpath = Deno.cwd() + '/views/'
let eta = new Eta({ views: viewpath, cache: false, debug: true })

export async function renderCommunity(ctx) {
    try {
        const mostUsedApps = await listMostUsedApps(10);
        const recentlyUsedApps = await listMostUsedApps(10); // Reusing this function as there's no specific "recently used" function
        const mostActiveUsers = await listMostActiveUsers(10);
        const listOfAllUsers = await listUsers();
        const allUsers = listOfAllUsers.map(doc => doc.value.username);

        // Fetch additional app information for each app
        const appsWithDetails = await Promise.all(mostUsedApps.map(async (app) => {
            const appVersion = await retrieveLatestAppVersion(app.appid);
            return {
                ...app,
                name: appVersion?.value?.groups[0]?.name || 'Unnamed App',
                link: `/app/${app.appid}`
            };
        }));

        const packagedMostUsedApps = await packageAppList(appsWithDetails, ctx.state.user.usrname, "");
        const packagedRecentlyUsedApps = await packageAppList(recentlyUsedApps, ctx.state.user.usrname, "");

        ctx.response.body = eta.render('community', {
            mostUsedApps: packagedMostUsedApps,
            recentlyUsedApps: packagedRecentlyUsedApps,
            mostActiveUsers,
            allUsers
        });
    } catch (error) {
        console.error('Error in renderCommunity:', error);
        ctx.response.status = 500;
        ctx.response.body = 'Internal server error';
    }
}
