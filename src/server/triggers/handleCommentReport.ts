import { OnCommentReportRequest, T2, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions";
import { fixCommentReportTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { reddit } from "@devvit/web/server";

export const handleCommentReport = async (c: Context) => {
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

    for (const result of results) {
        await actionRules(request.comment.id, result);
    }

    return c.json<TriggerResponse>({ message: "comment report handled" }, 200);
};
