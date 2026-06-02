import { OnCommentCreateRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { fixContentCreationRequest } from "../core";
import { checkComment } from "../core/contentMatcher";
import { actionRules } from "../core/ruleActions/actionRules";

export const handleCommentCreate = async (c: Context) => {
    const request = await fixContentCreationRequest(await c.req.json<OnCommentCreateRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment create handled, no comment in request" }, 200);
    }

    const result = await checkComment(request, false);
    if (!result) {
        return c.json<TriggerResponse>({ message: "comment create handled, no matches found" }, 200);
    }

    await actionRules(request.comment.id, result);

    return c.json<TriggerResponse>({ message: "comment create handled" }, 200);
};
