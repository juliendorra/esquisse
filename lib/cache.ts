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

// canot set path as primary index because of collision tests when overwriting
// see: https://github.com/oliver-oloughlin/kvdex/issues/143#issuecomment-1839577965
const db = kvdex(kv, {
    cache: collection(CacheModel, {
        indices: {
            path: "secondary",
        }
    })
});

export async function setCache(path: string, cachekey: string, expiryInSeconds: number): Promise<void> {
    const expiry = Date.now() + expiryInSeconds * 1000;

    const result = await db.cache.set(path, { path, expiry, cachekey }, { overwrite: true });

    console.log("[CACHE] cache set for ", path, " to expire on ", new Date(expiry).toLocaleString());

    console.log("[CACHE] cache set for ", path, " Result ", result);
}

export async function invalidateCache(path: string): Promise<void> {
    const result = await db.cache.set(path, { path, expiry: 0, cachekey: "" }, { overwrite: true });
    console.log("[CACHE] cache invalidated for ", path, " Result ", result);
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

    console.log("[CACHE] no cache found for ", path);
    return null;
}