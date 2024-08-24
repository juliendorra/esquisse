// manage the cache expiry values
import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";
import { downloadCachedHTML } from "./file-storage.ts";

export type CacheEntry = {
    path: string;
    expiry: number;
    cachekey: string;
};

const CacheModel = model<CacheEntry>();

const kv = await Deno.openKv();

const db = kvdex(kv, {
    cache: collection(CacheModel, {
        indices: {
            path: "primary",
        }
    })
});

export async function setCache(path: string, cachekey: string, expiryInSeconds: number): Promise<void> {
    const expiry = Date.now() + expiryInSeconds * 1000;
    await db.cache.set(path, { path, expiry, cachekey });

    console.log("[CACHE] cache set for ", path, " to expire on ", expiry);
}

export async function checkCache(path: string): Promise<string | null> {
    const cacheEntry = await db.cache.find(path);
    if (cacheEntry && cacheEntry.value.expiry > Date.now()) {

        console.log("[CACHE] cache not expired for ", path);
        return cacheEntry.value.cachekey;
    }
    return null;
}

export async function readCache(path: string): Promise<string | null> {

    const cacheEntry = await db.cache.find(path);

    if (cacheEntry && cacheEntry.value.expiry > Date.now()) {

        console.log("[CACHE] cache found for ", path);
        return await downloadCachedHTML(cacheEntry.value.cachekey);
    }
    return null;
}