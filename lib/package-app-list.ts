import { retrieveMultipleLastAppVersions } from "./apps.ts";
import type { Apps } from "./apps.ts";

export async function packageAppList(apps: [] | Apps[], username: string, targetUsername: string) {

    const appProcessingPromises = apps.map(async (app) => {
        // Weak attempt to weed out malformed apps. Should validate against schema instead
        if (!app.groups) return null;

        const isdeleted = app.groups.length === 0;

        // Don't show the deleted apps of a user to another user
        if (isdeleted && username !== targetUsername) return null;

        // By default, use the last version of the groups from the app
        let groups = app.groups;

        // For deleted apps (emptied apps), retrieve the last non-empty version
        if (isdeleted) {
            const versions = await retrieveMultipleLastAppVersions(app.appid, 3);
            if (versions) {
                for (const version of versions) {
                    if (version.value.groups.length > 0) {
                        // Found a non-empty version, use that
                        groups = version.value.groups;
                        break;
                    }
                }
            }
            // if we didn't find a non-empty version, we'll just fallback on the empty (deleted) last version
        }

        const groupstypes = groups.map(group => group.type);

        return {
            name: groups[0]?.name || 'Unnamed App', // Name from the first group's name
            appid: app.appid,
            link: `/app/${app.appid}`,
            groupstypes: groupstypes,
            isdeleted: isdeleted,
            recoverablegroups: isdeleted ? groups : null,
        };
    });

    // Wait for all promises to settle and filter out null values
    const allApps = (await Promise.allSettled(appProcessingPromises))
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<unknown>).value);

    return allApps;
}
