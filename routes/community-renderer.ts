import "https://deno.land/x/dotenv/load.ts";
import { Eta } from "https://deno.land/x/eta/src/index.ts";
import { listMostUsedApps, listMostActiveUsers, listRecentlyUsedApps } from "../lib/usage.ts";
import { listRecentlyActiveUsers, listExpertUsers } from "../lib/usage.ts";
import { packageAppList } from "../lib/package-app-list.ts";
import { retrieveLatestAppVersion, listMostCreativeUsers } from "../lib/apps.ts";
import { listUsers } from "../lib/users.ts";

import type { Apps } from "../lib/apps.ts";
import { isDefined } from "../lib/utility.ts";

const viewpath = Deno.cwd() + '/views/'
const eta = new Eta({ views: viewpath, cache: false, debug: true })

export async function renderCommunity(ctx) {
    try {

        // Apps

        // Most Used App IDs: 
        // [
        //     { appid: "sk82prk3dsyy6x", count: 468 },
        //     { appid: "f33wdywxhmx1rr", count: 272 },
        //     { appid: "z5j8k47gy6w3vy", count: 114 },
        // ]
        const mostUsedAppIDs = await listMostUsedApps(10);

        // Recently Used Apps
        // [
        //   { appid: "2xfn5yvhdvzzv2", timestamp: "2024-08-17T20:50:47.761Z" },
        //   { appid: "2swcr2gg5qqt4c", timestamp: "2024-08-17T17:45:40.107Z" }
        // ]
        const recentlyUsedAppIDs = await listRecentlyUsedApps(10);

        // Fetch additional app information for each app
        // [{
        //     appid: "sk82prk3dsyy6x",
        //     count: 468,
        //     name: "first pass image",
        //     link: "/app/sk82prk3dsyy6x",
        //     groupstypes: [ "image", "image", "static" ]
        //   },...]

        const mostUsedApps = await Promise.all(
            mostUsedAppIDs
                .map(async (app) => {
                    const appVersion = await retrieveLatestAppVersion(app.appid);
                    if (appVersion && appVersion.type == "write") {
                        return appVersion.value;
                    }
                    return undefined;
                })
        )
        const filteredMostUsedApps: Apps[] = mostUsedApps.filter(isDefined);
        const packagedMostUsedApps = await packageAppList(filteredMostUsedApps, ctx.state.user.username, "");

        const recentlyUsedApps = await Promise.all(recentlyUsedAppIDs
            .map(async (app) => {
                const appVersion = await retrieveLatestAppVersion(app.appid);
                if (appVersion && appVersion.type == "write") {
                    return appVersion.value;
                }
                return undefined;
            })
        )
        const filteredRecentlyUsedApps: Apps[] = recentlyUsedApps.filter(isDefined);
        const packagedRecentlyUsedApps = await packageAppList(filteredRecentlyUsedApps, ctx.state.user.usrname, "");

        // Users

        const recentlyActiveUsers = await listRecentlyActiveUsers(30);
        const listOfAllUsers = await listUsers();
        const allUsers = listOfAllUsers.map(doc => doc.value.username);

        // Badge list
        // based on usage volume
        const mostActiveUsers = await listMostActiveUsers(10);
        // based on the number of different apps used (usage diversity)
        const expertUsers = await listExpertUsers(10);
        // based on the number of apps created or cloned (app ownership)
        const mostCreativeUsers = await listMostCreativeUsers(10);

        ctx.response.body = eta.render('community', {
            mostUsedApps: packagedMostUsedApps,
            recentlyUsedApps: packagedRecentlyUsedApps,
            mostActiveUsers,
            recentlyActiveUsers,
            expertUsers,
            mostCreativeUsers,
            allUsers
        });
    } catch (error) {
        console.error('Error in renderCommunity:', error);
        ctx.response.status = 500;
        ctx.response.body = 'Internal server error';
    }
}