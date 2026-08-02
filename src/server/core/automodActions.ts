import { redis, settings } from "@devvit/web/server";
import { addDays } from "date-fns";
import { AppSetting } from "./appSettings";

function getAutomodActionKey (targetId: string) {
    return `automodAction:${targetId}`;
}

export async function storeRecordOfAutomodAction (targetId: string) {
    if (await settings.get<boolean>(AppSetting.SkipRulesThatAutomodHasActedOn)) {
        const key = getAutomodActionKey(targetId);
        await redis.set(key, "true", { expiration: addDays(new Date(), 1) });
    }
}

export async function hasAutomodActionBeenTaken (targetId: string): Promise<boolean> {
    const key = getAutomodActionKey(targetId);
    const value = await redis.get(key);
    return value === "true";
}
