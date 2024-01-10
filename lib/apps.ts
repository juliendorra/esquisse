import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";

export {
    storeApp, retrieveLatestAppVersion, retrieveMultipleLastAppVersions, retrieveAppVersion, checkAppIdExists,
    storeResultMetadata, retrieveResultMetadata,
    checkAppIsByUser, retrieveAppsByUser,
    Apps
}

type Apps = {
    appid: string,
    timestamp: string,
    version: string;
    username: string;
    groups: Array<{
        name: string;
        data?: string;
        transform?: string;
        type: string;
        interactionState: string;
        resultDisplayFormat?: string;
    }>;
}

type Result = {
    resultid: string;
    username: string;
    timestamp: string;
    appid: string;
    appversiontimestamp: string;
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
                serialize: (obj) => new TextEncoder().encode(JSON.stringify(obj)),
                deserialize: (data) => JSON.parse(new TextDecoder().decode(data)),
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

async function storeApp(app: Apps): Promise<any> {

    console.log(app);

    const result = await db.apps.write(app.appid, app);

    console.log(`app ${app.appid}, (${app.groups[0].name}) written to kv store: `, result);

    return result;
}

// findHistory()  supports pagination and filtering starting kvdex v0.27.0

async function retrieveMultipleLastAppVersions(appid: string, limit: number = 5): Promise<Apps | null> {
    try {
        const history = await db.apps.findHistory(
            appid,
            {
                limit: limit,
                reverse: true, // newer first
            });

        // [ { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]
        console.log("All versions: ", history);

        return history.result;

    } catch (error) {
        console.error("Error retrieving all versions for url ID: ", appid, "Error: ", error);
        return null;
    }
}

async function retrieveLatestAppVersion(appid: string): Promise<Apps | null> {
    try {
        const history = await db.apps.findHistory(
            appid,
            {
                limit: 1,
                reverse: true, // newer first
            });

        const appVersion = history.result.length > 0 ? history.result[0] : null

        console.log("Latest app Version: ", appVersion);

        // [ { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]

        return appVersion;

    } catch (error) {
        console.error("Error retrieving latest version for url ID: ", appid, "Error: ", error);
        return null;
    }
}

// use the history entry timestamp
// findHistory()  supports pagination and filtering starting kvdex v0.27.0

async function retrieveAppVersion(appid: string, timestamp: string): Promise<Apps | null> {
    try {

        const history = await db.apps.findHistory(
            appid,
            {
                filter: (doc) => {
                    // timestamps are not stored as strings
                    return doc.timestamp.toISOString() === timestamp
                }
            });


        const appVersion = history.result.length > 0 ? history.result[0] : null

        console.log("App Version: ", appVersion);

        // [ { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]

        return appVersion;

    } catch (error) {
        console.error(`Error retrieving version ${timestamp} for url ID: `, appid, "Error: ", error);
        return null;
    }
}

async function checkAppIdExists(appid: string): Promise<boolean> {
    try {
        const appDocument = await db.apps.find(appid);

        console.log("checked if ", appid, " exists ", appDocument.value.appid === appid);

        return appDocument.value.appid === appid;

    } catch (error) {
        console.error("Error checking for url ID:", error);
        return false;
    }
}

async function checkAppIsByUser(appid: string, username: string | null): Promise<boolean> {

    if (!appid || !username) { return false }

    try {
        const latestGroups = await retrieveLatestAppVersion(appid);

        let isByUser = false

        if (latestGroups) {

            isByUser = (latestGroups.username === username)
        }

        return isByUser;

    } catch (error) {
        console.error("Error checking for url ID:", error);
        return false;
    }
}

async function storeResultMetadata(result: Result): Promise<any> {

    const addOperationResult = await db.results.add(result);

    console.log("Result added to kv store: ", addOperationResult.id, addOperationResult);

    return addOperationResult;
}

async function retrieveResultMetadata(resultid: string): Promise<{ id: string, versionstamp: string, value: Result } | null> {

    try {
        const resultByResultid = await db.results.findByPrimaryIndex("resultid", resultid)

        return resultByResultid;
    }
    catch (error) {
        console.error("Error retrieving result of ID: ", resultid, "Error: ", error);
        return null;
    }
}

async function retrieveAppsByUser(username: string): Promise<Apps[] | []> {
    try {

        const apps = await db.apps.findBySecondaryIndex('username', username);

        // console.log(`Retrieved apps for user ${username}: `, apps.result);

        // document is { id, versionstamp,  value }
        // returning an array of apps objects
        return apps.result.map(doc => doc.value);

    } catch (error) {
        console.error("Error retrieving apps by user: ", username, "Error: ", error);
        return [];
    }
}
