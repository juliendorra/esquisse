import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";
import { ulid } from "https://deno.land/std/ulid/mod.ts";

// Defining the Group type
type Groups = {
    urlid: string,
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

// Creating a standard model for Group
const GroupsModel = model<Groups>();

// Open the KV database
const kv = await Deno.openKv();

// Setting up the database with collections
const db = kvdex(kv, {
    apps: collection(GroupsModel, {
        indices: {
            urlid: "secondary",
            timestamp: "secondary",
        },
        serialized: true,
        // ulids can be ordered by insertion time, contrary to  default kvdex crypto.randomUUID(). 
        // https://github.com/oliver-oloughlin/kvdex/issues/126#issuecomment-1826809952 
        idGenerator: () => ulid()
    })
});

export async function storeGroups(groups: Groups): Promise<any> {

    const result = await db.apps.add(groups);

    console.log("Groups added to kv store: ", result.id, result);

    return result;
}

export async function retrieveAllGroupsVersions(urlid: string): Promise<Groups | null> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'urlid',
            urlid,
            {
                reverse: true // Sorting in descending order
            });

        console.log("All versions: ", allGroups.result);  // [ { id, versionstamp, value: { version, urlid, timestamp, username, groups:[...] } }, ... ]

        return allGroups.result;

    } catch (error) {
        console.error("Error retrieving all versions for url ID: ", urlid, "Error: ", error);
        return null;
    }
}

export async function retrieveLatestGroups(urlid: string): Promise<Groups | null> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'urlid',
            urlid,
            {
                limit: 1,
                reverse: true // Sorting in descending order
            });

        console.log("Latest version: ", allGroups.result); // [ { id, versionstamp, value: { version, urlid, timestamp, username, groups:[...] } }, ... ]

        const latestGroups = allGroups.result.length > 0 ? allGroups.result[0].value : null

        console.log("Most Recent Group Version: ", latestGroups);

        return latestGroups;

    } catch (error) {
        console.error("Error retrieving latest version for url ID: ", urlid, "Error: ", error);
        return null;
    }
}

export async function checkIdExists(urlid: string): Promise<boolean> {
    try {
        const allGroups = await db.apps.findBySecondaryIndex(
            'urlid',
            urlid,
            {
                limit: 1,
                reverse: true // Sorting in descending order
            });

        console.log("checked if ", urlid, " exists");

        return allGroups.result.length > 0;

    } catch (error) {
        console.error("Error checking for url ID:", error);
        return false;
    }
}