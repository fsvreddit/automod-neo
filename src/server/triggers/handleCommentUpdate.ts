import { OnCommentUpdateRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { fixContentCreationRequest } from "../core";
import { checkComment } from "../core/contentMatcher";
import { actionRules } from "../core/ruleActions/actionRules";

export const handleCommentUpdate = async (c: Context) => {
    const request = await fixContentCreationRequest(await c.req.json<OnCommentUpdateRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment update handled, no comment in request" }, 200);
    }

    const result = await checkComment(request, false);
    if (!result) {
        return c.json<TriggerResponse>({ message: "comment update handled, no matches found" }, 200);
    }

    await actionRules(request.comment.id, result);

    return c.json<TriggerResponse>({ message: "comment update handled" }, 200);
};
