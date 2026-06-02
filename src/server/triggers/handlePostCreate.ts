import { OnPostCreateRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { fixContentCreationRequest } from "../core";
import { checkPost } from "../core/contentMatcher";
import { actionRules } from "../core/ruleActions/actionRules";

export const handlePostCreate = async (c: Context) => {
    const request = await fixContentCreationRequest(await c.req.json<OnPostCreateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post create handled, no post in request" }, 200);
    }

    const result = await checkPost(request);
    if (!result) {
        return c.json<TriggerResponse>({ message: "post create handled, no matches found" }, 200);
    }

    await actionRules(request.post.id, result);

    return c.json<TriggerResponse>({ message: "post create handled" }, 200);
};
