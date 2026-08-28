import { OnPostReportRequest, T2, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { ActionRules, AutomodRuleChecker, getReportRulesForSubreddit } from "../core";
import { fixPostReportTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { reddit } from "@devvit/web/server";
import pluralize from "pluralize";
import { addMinutes } from "date-fns";

export const handlePostReport = async (c: Context) => {
    const now = Date.now();
    const request = await fixPostReportTriggerEvent(await c.req.json<OnPostReportRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post report handled, no post in request" }, 200);
    }

    const rules = await getReportRulesForSubreddit();
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post report handled, no rules found" }, 200);
    }

    const postAuthor = await reddit.getUserById(request.post.authorId as T2);
    if (!postAuthor) {
        return c.json<TriggerResponse>({ message: "post report handled, post author not found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    console.log(`Checking post report for post ${request.post.id} against ${rules.length} ${pluralize("rule", rules.length)}.`);
    const results = await ruleChecker.checkPost(request.post.id as T3);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "post report handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`postReport:${request.post.id}`, { expiration: addMinutes(new Date(), 5) })) {
        return c.json<TriggerResponse>({ message: "post report handled, trigger already handled" }, 200);
    }

    const redditData = ruleChecker.getRedditData();
    redditData.users[postAuthor.username] ??= postAuthor;

    const actionRules = new ActionRules({
        targetId: request.post.id as T3,
        matchedRules: results,
        redditData,
    });

    await actionRules.actionRules();

    console.log(`Post report handled in ${Date.now() - now}ms for post ${request.post.id} with ${results.length} ${pluralize("rule", results.length)} matched.`);

    return c.json<TriggerResponse>({ message: "post report handled" }, 200);
};
