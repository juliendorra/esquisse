import { kvdex, model, collection } from "https://deno.land/x/kvdex/mod.ts";
import { hash } from "./bcrypt.ts";
import { Validator } from "npm:jsonschema";
import { invalidateCache } from "./cache.ts";

export { createUser, getUserPasswordHash, bulkCreateUsers, listUsers }

const userListSchema = {
    type: "array",
    items: {
        type: "object",
        properties: {
            username: { type: "string" },
            userdisplayname: { type: "string" },
            password: { type: "string" }
        },
        required: ["username", "userdisplayname", "password"],
        additionalProperties: false
    }
};

type User = {
    username: string,
    userdisplayname: string,
    hashedpassword: string,
    created: string,
}

type UserInfos = {
    username: string,
    userdisplayname: string,
    password: string,
}

const UserModel = model<User>();

const kv = await Deno.openKv();

const db = kvdex(kv, {

    users: collection(UserModel, {
        indices: {
            username: "primary",
            userdisplayname: "secondary",
        }
    })
});

async function createUser(userInfos: UserInfos): Promise<any> {

    userInfos.username = userInfos.username.toLowerCase().trim();

    if (!userInfos.username || !userInfos.userdisplayname || !userInfos.password) { return null };

    if (!await checkUserExists(userInfos.username)) {

        const user: User = {
            username: userInfos.username,
            userdisplayname: userInfos.userdisplayname,
            hashedpassword: await hash(userInfos.password),
            created: new Date().toISOString(),
        }

        const result = await db.users.add(user);

        if (result.ok) {
            console.log("User added to kv store: ", result.id, result);
            invalidateCache("/community");
        }

        return result;
    }
    else {
        console.log("Username already exists, user can't be created: ", userInfos.username);
        return null;
    }
}

async function checkUserExists(username: string): Promise<boolean> {
    try {
        username = username.toLowerCase().trim();

        const user = await db.users.findByPrimaryIndex('username', username);
        console.log("checked if ", username, " exists: ", user);

        return user ? true : false;

    } catch (error) {
        console.error("Error checking for url ID:", error);
        return false;
    }
}

async function getUserPasswordHash(username: string): Promise<string | null> {

    try {
        const user = await db.users.findByPrimaryIndex('username', username);

        return user ? user.value.hashedpassword : null;
    }
    catch (error) {
        console.error("Error retrieving user hash: ", username, " Error: ", error);
        return null;
    }
}

type ListOfUsersInfos = Array<UserInfos>

async function bulkCreateUsers(listOfUsersInfos: ListOfUsersInfos) {

    const validator = new Validator();

    const validationResult = validator.validate(listOfUsersInfos, userListSchema);
    if (!validationResult.valid) {
        console.error("Validation error: ", validationResult.errors);
        return { userscreated: [], usersrejected: [] };
    }
    else {
        console.log("Validation of bulk list of users successful")
    }

    const results: {
        userscreated: UserInfos[];
        usersrejected: UserInfos[];
    } = {
        userscreated: [],
        usersrejected: [],
    };


    for (const userInfos of listOfUsersInfos) {

        const addResult = await createUser(userInfos);

        if (addResult && addResult.ok) {
            results.userscreated.push(userInfos);
        }
        else {
            results.usersrejected.push(userInfos);
        }
    }

    return results;

}

async function listUsers() {

    const { result } = await db.users.getMany()

    return result;

}