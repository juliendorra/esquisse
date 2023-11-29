// Workaround for workers not available on Deno Deploy 
// https://github.com/JamesBroadberry/deno-bcrypt/issues/26#issue-1137157761

import {
    hash as hashPromise,
    hashSync,
    compare as comparePromise,
    compareSync,
} from "https://deno.land/x/bcrypt/mod.ts";

export const isRunningInDenoDeploy = (globalThis as any).Worker === undefined;

export const hash: typeof hashPromise = isRunningInDenoDeploy
    ? (plaintext: string, salt: string | undefined = undefined) =>
        new Promise((res) => res(hashSync(plaintext, salt)))
    : hashPromise;
export const compare: typeof comparePromise = isRunningInDenoDeploy
    ? (plaintext: string, hash: string) =>
        new Promise((res) => res(compareSync(plaintext, hash)))
    : comparePromise;