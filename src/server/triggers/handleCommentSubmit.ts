import { OnCommentCreateRequest, T1, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules } from "../core/ruleActions";
import { fixCommentTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { isUserIgnoredForTriggers } from "../core";

export const handleCommentSubmit = async (c: Context) => {
    const request = await fixCommentTriggerEvent(await c.req.json<OnCommentCreateRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no comment in request" }, 200);
    }

    if (!request.author?.name) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no author name in request" }, 200);
    }

    if (isUserIgnoredForTriggers(request.author.name)) {
        return c.json<TriggerResponse>({ message: "comment submit handled, author is ignored" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkComment(request.comment, request.author.name);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`commentSubmit:${request.comment.id}`)) {
        return c.json<TriggerResponse>({ message: "comment submit handled, trigger already handled" }, 200);
    }

    console.log(JSON.stringify(results, null, 2));

    const actionRules = new ActionRules({ targetId: request.comment.id as T1, matchedRules: results });
    await actionRules.actionRules();

    return c.json<TriggerResponse>({ message: "comment submit handled" }, 200);
};
