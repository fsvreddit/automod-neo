import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearUserBanCache, clearUserRoleCache, storeRecordOfAutomodAction } from "../core";

export const handleModAction = async (c: Context) => {
    const request = await c.req.json<OnModActionRequest>();

    if ((request.action?.includes("moderator") || request.action?.includes("contributor")) && request.targetUser?.id) {
        await clearUserRoleCache(request.targetUser.name);
    }

    const removalActions = ["removecomment", "removelink", "spamcomment", "spamlink"];
    if (request.moderator?.name === "AutoModerator" && request.action && removalActions.includes(request.action)) {
        let targetId: string | undefined;
        if (request.targetComment?.id) {
            targetId = request.targetComment.id;
        } else if (request.targetPost?.id) {
            targetId = request.targetPost.id;
        }
        if (targetId) {
            await storeRecordOfAutomodAction(targetId);
        }
    }

    const banActions = ["banuser", "unbanuser"];
    if (request.action && banActions.includes(request.action) && request.targetUser?.id) {
        await clearUserBanCache(request.targetUser.name);
    }

    return c.json<TriggerResponse>({ message: "mod action handled" }, 200);
};
