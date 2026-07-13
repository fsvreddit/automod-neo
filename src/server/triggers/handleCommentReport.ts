import { OnCommentReportRequest, T1, T2, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules } from "../core/ruleActions";
import { fixCommentReportTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { reddit } from "@devvit/web/server";
import pluralize from "pluralize";

export const handleCommentReport = async (c: Context) => {
    const now = Date.now();
    const request = await fixCommentReportTriggerEvent(await c.req.json<OnCommentReportRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment report handled, no comment in request" }, 200);
    }

    const rules = await getRulesForSubreddit().then(rules => rules.filter(rule => rule.reports !== undefined));
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "comment report handled, no rules found" }, 200);
    }

    const commentAuthor = await reddit.getUserById(request.comment.author as T2);
    if (!commentAuthor) {
        return c.json<TriggerResponse>({ message: "comment report handled, comment author not found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkComment(request.comment, commentAuthor.username);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "comment report handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`commentReport:${request.comment.id}`)) {
        return c.json<TriggerResponse>({ message: "comment report handled, trigger already handled" }, 200);
    }

    const actionRules = new ActionRules({ targetId: request.comment.id as T1, matchedRules: results });
    await actionRules.actionRules();

    console.log(`Comment report handled in ${Date.now() - now}ms for comment ${request.comment.id} with ${results.length} ${pluralize("rule", results.length)} matched.`);

    return c.json<TriggerResponse>({ message: "comment report handled" }, 200);
};
