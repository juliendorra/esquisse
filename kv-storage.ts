// Open the KV database
const kv = await Deno.openKv();

export async function storeGroups(id: string, groups: any): Promise<void> {
    let existingData: any[] = [];
    try {
        const entry = await kv.get([id]);
        if (entry && entry.value) {
            existingData = entry.value;
        }
    } catch (error) {
        console.log("KV entry not found for ID:", id);
    }
    // We append the new group structure, keeping a version history
    existingData.push(groups);

    await kv.set([id], existingData);
}

export async function retrieveGroups(id: string): Promise<any> {
    try {
        const entry = await kv.get([id]);
        if (entry && entry.value) {
            return entry.value.pop(); // Return the latest version of the groups
        }
    } catch (error) {
        console.error("Error retrieving groups for ID:", id);
        return null;
    }
    return null;
}

// Function to check if an ID exists in KV
export async function checkIdExists(id: string): Promise<boolean> {
    try {
        const entry = await kv.get([id]);
        return entry !== null;
    } catch {
        return false;
    }
}
