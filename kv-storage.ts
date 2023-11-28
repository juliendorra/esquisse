import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";
import { ulid } from "https://deno.land/std/ulid/mod.ts";

export { storeGroups, retrieveLatestGroups, checkAppIdExists, storeResults, retrieveResults }

type Groups = {
    appid: string,
    timestamp: string,
    version: string;
    username: string;
    items: Array<{
        name: string;
        data?: string;
        transform?: string;
        type: string;
        interactionState: string;
    }>;
}

type Result = {
    resultid: string;
    appid: string;
    timestamp: string;
    username: string;
    items: Array<{
        name: string;
        data?: string;
        transform?: string;
        result: string;
        type: string;
        interactionState: string;
    }>;
}

const ResultModel = model<Result>();

const GroupsModel = model<Groups>();

const kv = await Deno.openKv();

const db = kvdex(kv, {
    apps: collection(GroupsModel, {
        indices: {
            appid: "secondary",
            timestamp: "secondary",
        },
        serialized: {
            serialize: (obj) => new TextEncoder().encode(JSON.stringify(obj)),
            deserialize: (data) => JSON.parse(new TextDecoder().decode(data)),
        },
        // ulids can be ordered by insertion time, contrary to  default kvdex crypto.randomUUID(). 
        // https://github.com/oliver-oloughlin/kvdex/issues/126#issuecomment-1826809952 
        idGenerator: () => ulid()
    }),

    results: collection(ResultModel, {
        indices: {
            resultid: "primary",
            appid: "secondary",
            timestamp: "secondary",
        },
        serialized: {
            serialize: (obj) => new TextEncoder().encode(JSON.stringify(obj)),
            deserialize: (data) => JSON.parse(new TextDecoder().decode(data)),
        },
        idGenerator: () => ulid()
    })
});

async function storeGroups(groups: Groups): Promise<any> {

    const result = await db.apps.add(groups);

    console.log("Groups added to kv store: ", result.id, result);

    return result;
}

async function retrieveAllGroupsVersions(appid: string): Promise<Groups | null> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'appid',
            appid,
            {
                reverse: true // Sorting in descending order
            });

        console.log("All versions: ", allGroups.result);  // [ { id, versionstamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]

        return allGroups.result;

    } catch (error) {
        console.error("Error retrieving all versions for url ID: ", appid, "Error: ", error);
        return null;
    }
}

async function retrieveLatestGroups(appid: string): Promise<Groups | null> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'appid',
            appid,
            {
                limit: 1,
                reverse: true // Sorting in descending order
            });

        console.log("Latest version: ", allGroups.result); // [ { id, versionstamp, value: { version, appid, timestamp, username, groups:[...] } }, ... ]

        const latestGroups = allGroups.result.length > 0 ? allGroups.result[0].value : null

        console.log("Most Recent Group Version: ", latestGroups);

        return latestGroups;

    } catch (error) {
        console.error("Error retrieving latest version for url ID: ", appid, "Error: ", error);
        return null;
    }
}

async function checkAppIdExists(appid: string): Promise<boolean> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'appid',
            appid,
            {
                limit: 1,
                reverse: true // Sorting in descending order
            });

        console.log("checked if ", appid, " exists");

        return allGroups.result.length > 0;

    } catch (error) {
        console.error("Error checking for url ID:", error);
        return false;
    }
}

async function storeResults(result: Result): Promise<void> {
    const addOperationResult = await db.results.add(result);

    console.log("Result added to kv store: ", addOperationResult.id, addOperationResult);

    return addOperationResult;
}

async function retrieveResults(resultid: string): Promise<Results | null> {

    try {
        const resultByResultid = await db.results.findByPrimaryIndex("resultid", resultid)

        return resultByResultid;
    }
    catch (error) {
        console.error("Error retrieving result of ID: ", resultid, "Error: ", error);
        return null;
    }
}

