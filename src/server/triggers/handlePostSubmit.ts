import { OnPostCreateRequest, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions/actionRules";
import { fixPostTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";

export const handlePostSubmit = async (c: Context) => {
    const request = await fixPostTriggerEvent(await c.req.json<OnPostCreateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post submit handled, no post in request" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post submit handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const result = await ruleChecker.checkPost(request.post.id as T3);

    if (!result) {
        return c.json<TriggerResponse>({ message: "post submit handled, no matches found" }, 200);
    }

    await actionRules(request.post.id, result);

    return c.json<TriggerResponse>({ message: "post submit handled" }, 200);
};
