import { kvdex, model, collection, Document, HistoryEntry } from "https://deno.land/x/kvdex/mod.ts";
import { uploadAppVersion, downloadAppVersion } from "./file-storage.ts";
import { blobToFullHash } from "./utility.ts";

export {
    storeApp, retrieveLatestAppVersion, retrieveMultipleLastAppVersions, retrieveAppVersion, checkAppIdExists,
    storeResultMetadata, retrieveResultMetadata,
    retrieveResultsByUser,
    checkAppIsByUser, retrieveAppsByUser
};
export type { Apps };

type Groups = {
    id: string;
    name: string;
    data?: string;
    transform?: string;
    type: string;
    interactionState: string;
    controlnetEnabled: boolean;
    resultDisplayFormat?: string;
};

type AppsBase = {
    appid: string;
    timestamp: string;
    version: string;
    username: string;
};

// Two types for apps: one with `versionhash` (stored on S3) and one with `groups` (stored on KV, legacy)
type AppsOnlyMetadata = AppsBase & {
    versionhash: string;
    groups?: never;
};

type AppsWithGroups = AppsBase & {
    versionhash?: never;
    groups: Array<Groups>;
};

type Apps = AppsOnlyMetadata | AppsWithGroups;

type Result = {
    resultid: string;
    username: string;
    timestamp: string;
    appid: string;
    appversiontimestamp: string;
    name?: string;
    snippet?: string;
}

const ResultModel = model<Result>();

const AppsModel = model<Apps>();

const kv = await Deno.openKv();

const db = kvdex(kv, {
    apps: collection(
        AppsModel,
        {
            indices: {
                appid: "secondary",
                timestamp: "secondary",
                username: "secondary",
            },
            history: true,
            serialized: {
                serialize: (obj: object) => new TextEncoder().encode(JSON.stringify(obj)),
                deserialize: (data: ArrayBuffer) => JSON.parse(new TextDecoder().decode(data)),
            }
        }),

    results: collection(
        ResultModel,
        {
            indices: {
                resultid: "primary",
                appid: "secondary",
                timestamp: "secondary",
                username: "secondary",
            }
        })
});

async function storeApp(app: AppsWithGroups): Promise<any> {
    const appDataString = JSON.stringify(app);
    const versionhash = await blobToFullHash(new Blob([appDataString], { type: "application/json" }));

    const uploadStatus = await uploadAppVersion(appDataString, app.appid, versionhash);

    if (!uploadStatus.success) {
        throw new Error("Failed to upload app version to S3");
    }

    const appMetadata: AppsOnlyMetadata = {
        appid: app.appid,
        timestamp: app.timestamp,
        version: app.version,
        username: app.username,
        versionhash,
    };

    const result = await db.apps.set(app.appid, appMetadata, { overwrite: true });

    if (app.groups && app.groups[0]) {
        console.log(`App ${app.appid}, (${app.groups[0]?.name || 'Unnamed App'}) written to KV store: `, result);
    } else {
        console.log(`App ${app.appid}, (empty app) written to KV store: `, result);
    }

    return result;
}

// findHistory()  supports pagination and filtering starting kvdex v0.27.0

async function retrieveMultipleLastAppVersions(appid: string, limit = 5): Promise<Apps[] | any[]> {
    try {
        const history = await db.apps.findHistory(
            appid,
            {
                limit: limit,
                reverse: true, // newer first
            });

        console.log("[RETRIEVING MULTIPLE VERSIONS] history result is: ", history.result);

        // legacy full groups: [ { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]
        // metadata only: [ { type, timestamp, value: { version, appid, timestamp, username, versionhash } }, ... ]

        const versionPromises = history.result
            .filter(doc => doc.type === "write" && doc.value)
            .map(async doc => {
                const version = await retrieveAppVersionFromSource(doc);
                console.log("Retrieved version of app ", appid, "Version is: ", version);
                return version;
            });

        const settledResults = await Promise.allSettled(versionPromises);
        const multipleLastAppVersions = settledResults
            .filter(result => result.status === "fulfilled" && result.value)
            .map(result => (result as PromiseFulfilledResult<HistoryEntry<Apps>>).value);

        return multipleLastAppVersions;

    } catch (error) {
        console.error("Error retrieving all versions for URL ID: ", appid, "Error: ", error);
        return [];
    }
}


async function retrieveLatestAppVersion(appid: string): Promise<HistoryEntry<Apps> | null> {
    try {
        const history = await db.apps.findHistory(
            appid,
            {
                limit: 1,
                reverse: true, // newer first
            });

        const appVersion = history.result.length > 0 ? history.result[0] : null;

        // legacy full groups { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }
        // metadata only { type, timestamp, value: { version, appid, timestamp, username, versionhash } }

        if (!appVersion) return null;

        return await retrieveAppVersionFromSource(appVersion);

    } catch (error) {
        console.error("Error retrieving latest version for URL ID: ", appid, "Error: ", error);
        return null;
    }
}

// use the history entry timestamp
// findHistory()  supports pagination and filtering starting kvdex v0.27.0

async function retrieveAppVersion(appid: string, timestamp: string): Promise<HistoryEntry<Apps> | null> {
    try {

        const history = await db.apps.findHistory(
            appid,
            {
                filter: (doc) => {
                    // timestamps are not stored as strings
                    return doc.timestamp.toISOString() === timestamp;
                }
            });

        const appVersion = history.result.length > 0 ? history.result[0] : null;

        if (!appVersion) return null;

        // legacy full groups { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }
        // metadata only { type, timestamp, value: { version, appid, timestamp, username, versionhash } }

        return await retrieveAppVersionFromSource(appVersion);

    } catch (error) {
        console.error(`Error retrieving version ${timestamp} for URL ID: `, appid, "Error: ", error);
        return null;
    }
}

async function checkAppIdExists(appid: string): Promise<boolean> {
    try {
        const appDocument = await db.apps.find(appid);

        console.log("checked if ", appid, " exists ", appDocument?.value.appid === appid);

        return appDocument?.value.appid === appid;

    } catch (error) {
        console.error("Error checking for URL ID:", error);
        return false;
    }
}

async function checkAppIsByUser(appid: string, username: string | null): Promise<boolean> {

    if (!appid || !username) { return false }

    try {
        const latestGroups = await retrieveLatestAppVersion(appid);

        let isByUser = false

        if (latestGroups && latestGroups.type == "write") {
            isByUser = (latestGroups.value.username === username)
        }

        else if (latestGroups && latestGroups.type == "delete") {
            throw new Error("The app was marked as deleted in the KVdex history");
        }

        return isByUser;

    } catch (error) {
        console.error("Error checking for URL ID:", error);
        return false;
    }
}

async function storeResultMetadata(result: Result): Promise<any> {

    const addOperationResult = await db.results.add(result);

    if (addOperationResult.ok) {
        console.log("Result added to kv store: ", addOperationResult.id, addOperationResult);
    }

    return addOperationResult;
}

async function retrieveResultMetadata(resultid: string): Promise<Document<Result, string> | null> {

    try {
        const resultByResultid = await db.results.findByPrimaryIndex("resultid", resultid);
        return resultByResultid;
    } catch (error) {
        console.error("Error retrieving result of ID: ", resultid, "Error: ", error);
        return null;
    }
}

async function retrieveAppsByUser(username: string): Promise<Apps[] | []> {
    try {

        const apps = await db.apps.findBySecondaryIndex(
            'username',
            username,
            {
                reverse: true, // newer first
            });

        // console.log(`Retrieved apps for user ${username}: `, apps.result);

        // legacy document is { id, versionstamp,  value: { version, appid, timestamp, username, groups:[...] } }
        // metadata only document is { id, versionstamp,  value: { version, appid, timestamp, username, versionhash } } }

        // returning an array of apps objects

        const appsByUser: Apps[] = [];

        for (const doc of apps.result) {

            const app = await retrieveAppFromSource(doc.value);

            console.log("Retrieved app by user: ", username, "App is: ", app);

            if (app) {
                appsByUser.push(app);
            }
        }

        return appsByUser

    } catch (error) {
        console.error("Error retrieving apps by user: ", username, "Error: ", error);
        return [];
    }
}

async function retrieveResultsByUser(username: string): Promise<Result[] | []> {
    try {

        const results = await db.results.findBySecondaryIndex(
            'username',
            username,
            {
                reverse: true, // newer first
            });

        // console.log(`Retrieved results from user ${username}: `, results.result);

        // document is { id, versionstamp,  value }
        // returning an array of result objects
        return results.result.map(doc => doc.value);

    } catch (error) {
        console.error("Error retrieving results by user: ", username, "Error: ", error);
        return [];
    }
}


async function retrieveAppVersionFromSource(appVersion: HistoryEntry<Apps>) {

    try {
        if (appVersion.type === "write" && appVersion.value.versionhash) {

            const downloadResponse = await downloadAppVersion(appVersion.value.appid, appVersion.value.versionhash);

            if (!downloadResponse) {
                throw new Error("Failed to download app version from S3");
            }

            appVersion.value = JSON.parse(downloadResponse);

            return appVersion;

        } else {
            return appVersion;
        }
    }
    catch (error) {
        if (appVersion.type === "write" && appVersion.value.versionhash) {
            console.error("Error retrieving app version from source: ", appVersion.value.appid, "Error: ", error);
        }
        else {
            console.error("Error retrieving app version from source: ", appVersion, "Error: ", error);
        }
        return null;
    }
}

async function retrieveAppFromSource(app: Apps) {

    try {
        if (app.versionhash) {

            const downloadResponse = await downloadAppVersion(app.appid, app.versionhash);

            if (!downloadResponse) {
                throw new Error("Failed to download app version from S3");
            }

            app = JSON.parse(downloadResponse);

            return app;

        } else {
            return app;
        }
    }
    catch (error) {
        console.error("Error retrieving app version from source: ", app.appid, "Error: ", error);
        return;
    }
}

export async function listMostCreativeUsers(limit = 10): Promise<{ username: string, appCount: number }[]> {

    try {
        const apps = await db.apps.getMany();
        const userAppCounts = apps.result.reduce((acc, doc) => {
            const username = doc.value.username;
            acc[username] = (acc[username] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(userAppCounts)
            .map(([username, appCount]) => ({ username, appCount }))
            .sort((a, b) => b.appCount - a.appCount)
            .slice(0, limit);
    } catch (error) {
        console.error("Error retrieving most creative users: ", error);
        return [];
    }
}