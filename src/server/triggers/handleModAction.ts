import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearUserRoleCache } from "../core";

export const handleModAction = async (c: Context) => {
    const request = await c.req.json<OnModActionRequest>();

    if ((request.action?.includes("moderator") || request.action?.includes("contributor")) && request.targetUser?.id) {
        await clearUserRoleCache(request.targetUser.name);
    }

    return c.json<TriggerResponse>({ message: "mod action handled" }, 200);
};
