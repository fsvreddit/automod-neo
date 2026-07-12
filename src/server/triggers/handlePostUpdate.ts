import { OnPostUpdateRequest, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions";
import { fixPostTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { addMinutes } from "date-fns";
import { isUserIgnoredForTriggers } from "../core";

export const handlePostUpdate = async (c: Context) => {
    const request = await fixPostTriggerEvent(await c.req.json<OnPostUpdateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post update handled, no post in request" }, 200);
    }

    if (!request.author?.name) {
        return c.json<TriggerResponse>({ message: "post update handled, no author name in request" }, 200);
    }

    if (isUserIgnoredForTriggers(request.author.name)) {
        return c.json<TriggerResponse>({ message: "post update handled, author is ignored" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post update handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkPost(request.post.id as T3);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "post update handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`postUpdate:${request.post.id}`, { expiration: addMinutes(new Date(), 1) })) {
        return c.json<TriggerResponse>({ message: "post update handled, trigger already handled" }, 200);
    }

    for (const result of results) {
        await actionRules(request.post.id, result);
    }

    return c.json<TriggerResponse>({ message: "post update handled" }, 200);
};
