import { OnPostCreateRequest, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules } from "../core/ruleActions";
import { fixPostTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { isUserIgnoredForTriggers } from "../core";
import pluralize from "pluralize";

export const handlePostSubmit = async (c: Context) => {
    const now = Date.now();
    const request = await fixPostTriggerEvent(await c.req.json<OnPostCreateRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post submit handled, no post in request" }, 200);
    }

    if (!request.author?.name) {
        return c.json<TriggerResponse>({ message: "post submit handled, no author name in request" }, 200);
    }

    if (isUserIgnoredForTriggers(request.author.name)) {
        return c.json<TriggerResponse>({ message: "post submit handled, author is ignored" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post submit handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkPost(request.post.id as T3);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "post submit handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`postSubmit:${request.post.id}`)) {
        return c.json<TriggerResponse>({ message: "post submit handled, trigger already handled" }, 200);
    }

    const actionRules = new ActionRules({ targetId: request.post.id as T3, matchedRules: results });
    await actionRules.actionRules();

    console.log(`Post submit handled in ${Date.now() - now}ms for post ${request.post.id} with ${results.length} ${pluralize("rule", results.length)} matched.`);

    return c.json<TriggerResponse>({ message: "post submit handled" }, 200);
};
