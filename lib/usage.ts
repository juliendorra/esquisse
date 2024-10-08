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

export async function listMostUsedApps(limit = 10): Promise<{ appid: string, count: number }[]> {
    try {
        const usages = await db.usage.getMany();
        const appCounts = usages.result.reduce((acc, doc) => {
            const appid = doc.value.appid;
            acc[appid] = (acc[appid] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(appCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([appid, count]) => ({ appid, count }));
    } catch (error) {
        console.error("Error retrieving most used apps: ", error);
        return [];
    }
}

export async function listLastActiveUsers(limit = 10): Promise<string[]> {
    try {
        const usages = await db.usage.getMany({
            limit,
            reverse: true, // newer first
        });
        return [...new Set(usages.result.map(doc => doc.value.username))];
    } catch (error) {
        console.error("Error retrieving last active users: ", error);
        return [];
    }
}

export async function listMostActiveUsers(limit = 10): Promise<{ username: string, count: number }[]> {
    try {
        const usages = await db.usage.getMany();
        const userCounts = usages.result.reduce((acc, doc) => {
            const username = doc.value.username;
            acc[username] = (acc[username] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([username, count]) => ({ username, count }));
    } catch (error) {
        console.error("Error retrieving most active users: ", error);
        return [];
    }
}

export async function listRecentlyUsedApps(limit = 10): Promise<{ appid: string, timestamp: string }[]> {
    try {
        const usages = await db.usage.getMany({
            limit,
            reverse: true, // newer first
        });

        const recentlyUsedApps = usages.result.reduce((acc, doc) => {
            const appid = doc.value.appid;
            if (!acc.some(app => app.appid === appid)) {
                acc.push({ appid, timestamp: doc.value.timestamp });
            }
            return acc;
        }, [] as { appid: string, timestamp: string }[]);

        return recentlyUsedApps.slice(0, limit);
    } catch (error) {
        console.error("Error retrieving recently used apps: ", error);
        return [];
    }
}

export async function listRecentlyActiveUsers(days = 30): Promise<string[]> {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
        const usages = await db.usage.getMany({
            filter: (doc) => new Date(doc.value.timestamp) >= thirtyDaysAgo,
        });
        return [...new Set(usages.result.map(doc => doc.value.username))];
    } catch (error) {
        console.error("Error retrieving recently active users: ", error);
        return [];
    }
}

export async function listExpertUsers(limit = 10): Promise<{ username: string, appCount: number }[]> {
    try {
        const usages = await db.usage.getMany();
        const userAppCounts = usages.result.reduce((acc, doc) => {
            const { username, appid } = doc.value;
            if (!acc[username]) acc[username] = new Set();
            acc[username].add(appid);
            return acc;
        }, {} as { [key: string]: Set<string> });

        return Object.entries(userAppCounts)
            .map(([username, appSet]) => ({ username, appCount: appSet.size }))
            .sort((a, b) => b.appCount - a.appCount)
            .slice(0, limit);
    } catch (error) {
        console.error("Error retrieving expert users: ", error);
        return [];
    }
}