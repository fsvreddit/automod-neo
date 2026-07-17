import { OnCommentUpdateRequest, T1, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules } from "../core/ruleActions";
import { fixCommentTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, AutomodRuleCheckerOpts, getRulesForSubreddit } from "../core/ruleExecution";
import { addMinutes } from "date-fns";
import { isUserIgnoredForTriggers } from "../core";
import pluralize from "pluralize";

export const handleCommentUpdate = async (c: Context) => {
    const now = Date.now();
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

    const opts: AutomodRuleCheckerOpts = { rules };

    if (request.author.flair) {
        opts.userFlair = {
            [request.author.name]: {
                flairText: request.author.flair.text,
                flairCssClass: request.author.flair.cssClass,
                flairTemplateId: request.author.flair.templateId,
            },
        };
    }

    const ruleChecker = new AutomodRuleChecker(opts);

    const results = await ruleChecker.checkComment(request.comment, request.author.name);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "comment update handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`commentUpdate:${request.comment.id}`, { expiration: addMinutes(new Date(), 1) })) {
        return c.json<TriggerResponse>({ message: "comment update handled, trigger already handled" }, 200);
    }

    const actionRules = new ActionRules({ targetId: request.comment.id as T1, matchedRules: results });
    await actionRules.actionRules();

    console.log(`Comment update handled in ${Date.now() - now}ms for comment ${request.comment.id} with ${results.length} ${pluralize("rule", results.length)} matched.`);

    return c.json<TriggerResponse>({ message: "comment update handled" }, 200);
};
