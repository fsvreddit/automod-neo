import { OnCommentUpdateRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions";
import { fixCommentTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { addMinutes } from "date-fns";
import { isUserIgnoredForTriggers } from "../core";

export const handleCommentUpdate = async (c: Context) => {
    const request = await fixCommentTriggerEvent(await c.req.json<OnCommentUpdateRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment update handled, no comment in request" }, 200);
    }

    if (!request.author?.name) {
        return c.json<TriggerResponse>({ message: "comment update handled, no author name in request" }, 200);
    }

    if (isUserIgnoredForTriggers(request.author.name)) {
        return c.json<TriggerResponse>({ message: "comment update handled, author is ignored" }, 200);
    }

    const rules = await getRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "comment update handled, no rules found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkComment(request.comment, request.author.name);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "comment update handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`commentUpdate:${request.comment.id}`, { expiration: addMinutes(new Date(), 1) })) {
        return c.json<TriggerResponse>({ message: "comment update handled, trigger already handled" }, 200);
    }

    for (const result of results) {
        await actionRules(request.comment.id, result);
    }

    return c.json<TriggerResponse>({ message: "comment update handled" }, 200);
};
