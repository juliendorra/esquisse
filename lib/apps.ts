import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";

export { storeApp, retrieveLatestAppVersion, retrieveMultipleLastAppVersions, retrieveAppVersion, checkAppIdExists, storeResults, retrieveResults, checkAppIsByUser, retrieveAppsByUser, Apps }

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
    appid: string;
    timestamp: string;
    username: string;
    groups: Array<{
        name: string;
        data?: string;
        transform?: string;
        result: string;
        type: string;
        interactionState: string;
    }>;
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
            },
            serialized: {
                serialize: (obj) => new TextEncoder().encode(JSON.stringify(obj)),
                deserialize: (data) => JSON.parse(new TextDecoder().decode(data)),
            }
        })
});

async function storeApp(app: Apps): Promise<any> {

    console.log(app);

    const result = await db.apps.write(app.appid, app);

    console.log(`app ${app.appid}, (${app.groups[0].name}) written to kv store: `, result);

    return result;
}

async function retrieveMultipleLastAppVersions(appid: string, limit: number = 5): Promise<Apps | null> {
    try {
        const history = await db.apps.findHistory(appid);

        console.log("All versions: ", history);  // [ { type, timestamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]

        return history.slice(-limit).reverse();

    } catch (error) {
        console.error("Error retrieving all versions for url ID: ", appid, "Error: ", error);
        return null;
    }
}

async function retrieveLatestAppVersion(appid: string): Promise<Apps | null> {
    try {
        const appDocument = await db.apps.find(appid);

        const app = appDocument ? appDocument.value : null;

        console.log("Most Recent App Version:\n", app, "\n END OF Most Recent App Version");

        return app;

    } catch (error) {
        console.error("Error retrieving latest version for url ID: ", appid, "Error: ", error);
        return null;
    }
}

async function retrieveAppVersion(appid: string, timestamp: string): Promise<Apps | null> {
    try {
        const appVersionOperationResult = await db.apps.findBySecondaryIndex(
            'appid',
            appid,
            {
                filter: (doc) => doc.value.timestamp = timestamp,
            });


        const appVersion = appVersionOperationResult.result.length > 0 ? appVersionOperationResult.result[0].value : null

        console.log("App Version: ", appVersionOperationResult);

        return appVersion;

    } catch (error) {
        console.error("Error retrieving latest version for url ID: ", appid, "Error: ", error);
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

async function storeResults(result: Result): Promise<any> {
    const addOperationResult = await db.results.add(result);

    console.log("Result added to kv store: ", addOperationResult.id, addOperationResult);

    return addOperationResult;
}

async function retrieveResults(resultid: string): Promise<Result | null> {

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
