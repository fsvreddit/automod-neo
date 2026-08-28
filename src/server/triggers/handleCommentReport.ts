import { OnCommentReportRequest, T1, T2, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules, AutomodRuleChecker, getReportRulesForSubreddit } from "../core";
import { fixCommentReportTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { reddit } from "@devvit/web/server";
import pluralize from "pluralize";
import { addMinutes } from "date-fns";

export const handleCommentReport = async (c: Context) => {
    const now = Date.now();
    const request = await fixCommentReportTriggerEvent(await c.req.json<OnCommentReportRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment report handled, no comment in request" }, 200);
    }

    const rules = await getReportRulesForSubreddit();
    if (rules.length === 0) {
        console.log("No rules found for comment report handling.");
        return c.json<TriggerResponse>({ message: "comment report handled, no rules found" }, 200);
    }

    const commentAuthor = await reddit.getUserById(request.comment.author as T2);
    if (!commentAuthor) {
        return c.json<TriggerResponse>({ message: "comment report handled, comment author not found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    console.log(`Checking comment report for comment ${request.comment.id} against ${rules.length} ${pluralize("rule", rules.length)}.`);
    const results = await ruleChecker.checkComment(request.comment, commentAuthor.username);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "comment report handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`commentReport:${request.comment.id}`, { expiration: addMinutes(new Date(), 5) })) {
        return c.json<TriggerResponse>({ message: "comment report handled, trigger already handled" }, 200);
    }

    const actionRules = new ActionRules({
        targetId: request.comment.id as T1,
        matchedRules: results,
        redditData: ruleChecker.getRedditData(),
    });

    await actionRules.actionRules();

    console.log(`Comment report handled in ${Date.now() - now}ms for comment ${request.comment.id} with ${results.length} ${pluralize("rule", results.length)} matched.`);

    return c.json<TriggerResponse>({ message: "comment report handled" }, 200);
};
