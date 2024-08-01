import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";

export type Usage = {
    timestamp: string;
    username: string;
    appid: string;
    endpoint: string;
    type: 'IMAGE' | 'TEXT';
};

const UsageModel = model<Usage>();

const kv = await Deno.openKv();

const db = kvdex(kv, {
    usage: collection(
        UsageModel,
        {
            indices: {
                timestamp: "secondary",
                username: "secondary",
                appid: "secondary",
            }
        })
});

export async function addUsageEntry(usage: Usage): Promise<any> {
    const result = await db.usage.add(usage);
    console.log(`Usage entry added to kv store: `, usage, result);
    return result;
}

export async function listLastUsagesByUser(username: string, limit = 5): Promise<Usage[]> {
    try {
        const usages = await db.usage.findBySecondaryIndex(
            'username',
            username,
            {
                limit: limit,
                reverse: true, // newer first
            }
        );
        return usages.result.map(doc => doc.value);
    } catch (error) {
        console.error("Error retrieving last usages by user: ", username, "Error: ", error);
        return [];
    }
}

