import { OnPostUpdateRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { checkPost } from "../core/contentMatcher";
import { actionRules } from "../core/ruleActions/actionRules";
import { fixPostTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";

export const handlePostUpdate = async (c: Context) => {
    const request = await fixPostTriggerEvent(await c.req.json<OnPostUpdateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post update handled, no post in request" }, 200);
    }

    const result = await checkPost(request);
    if (!result) {
        return c.json<TriggerResponse>({ message: "post update handled, no matches found" }, 200);
    }

    await actionRules(request.post.id, result);

    return c.json<TriggerResponse>({ message: "post update handled" }, 200);
};
