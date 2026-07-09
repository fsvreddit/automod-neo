import { OnPostUpdateRequest, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions/actionRules";
import { fixPostTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";

export const handlePostUpdate = async (c: Context) => {
    const request = await fixPostTriggerEvent(await c.req.json<OnPostUpdateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post update handled, no post in request" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post update handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const result = await ruleChecker.checkPost(request.post.id as T3);

    if (!result) {
        return c.json<TriggerResponse>({ message: "post update handled, no matches found" }, 200);
    }

    await actionRules(request.post.id, result);

    return c.json<TriggerResponse>({ message: "post update handled" }, 200);
};
