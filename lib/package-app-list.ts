import { retrieveMultipleLastAppVersions } from "./apps.ts";
import type { Apps } from "./apps.ts";

export async function packageAppList(apps: [] | Apps[], username: string, targetUsername: string) {

    const allApps = [];

    for (const app of apps) {

        // // weak attempt to weed out malformed apps. Should validate against schema instead
        if (!app.groups) { continue; }

        const isdeleted = app.groups.length === 0 ? true : false;

        // we don't show the deleted apps of an user to another user
        if (isdeleted && username !== targetUsername) { continue; }

        // by default we are using the last version of the groups from the app
        let groups = app.groups;

        // for deleted apps (emptied apps), retrieve the last non empty version
        if (isdeleted) {
            const versions = await retrieveMultipleLastAppVersions(app.appid, 10);
            if (versions) {
                for (const version of versions) {
                    if (version.value.groups.length > 0) {
                        // we found a non-empty version, let's use that
                        groups = version.value.groups;
                        break;
                    }
                }
            }
            // if we didn't find a non-empty version, we'll just fallback on the empty (deleted) last version
        }

        const groupstypes = groups.map(group => group.type);

        allApps.push(
            {
                name: groups[0]?.name || 'Unnamed App', // Name from the first group's name
                appid: app.appid,
                link: `/app/${app.appid}`,
                groupstypes: groupstypes,
                isdeleted: isdeleted,
                recoverablegroups: isdeleted ? groups : null,
            }
        );
    }
    return allApps;
}
