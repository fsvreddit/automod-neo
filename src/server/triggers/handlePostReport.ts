import { OnPostReportRequest, T2, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions";
import { fixPostReportTriggerEvent, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";
import { reddit } from "@devvit/web/server";

export const handlePostReport = async (c: Context) => {
    const request = await fixPostReportTriggerEvent(await c.req.json<OnPostReportRequest>());
    if (!request.post) {
        return c.json<TriggerResponse>({ message: "post report handled, no post in request" }, 200);
    }

    const rules = await getRulesForSubreddit().then(rules => rules.filter(rule => rule.reports !== undefined));
    if (rules.length === 0) {
        return c.json<TriggerResponse>({ message: "post report handled, no rules found" }, 200);
    }

    const postAuthor = await reddit.getUserById(request.post.authorId as T2);
    if (!postAuthor) {
        return c.json<TriggerResponse>({ message: "post report handled, post author not found" }, 200);
    }

    const ruleChecker = new AutomodRuleChecker({ rules });

    const results = await ruleChecker.checkPost(request.post.id as T3);

    if (results.length === 0) {
        return c.json<TriggerResponse>({ message: "post report handled, no matches found" }, 200);
    }

    if (await hasTriggerBeenHandled(`postReport:${request.post.id}`)) {
        return c.json<TriggerResponse>({ message: "post report handled, trigger already handled" }, 200);
    }

    for (const result of results) {
        await actionRules(request.post.id, result);
    }

    return c.json<TriggerResponse>({ message: "post report handled" }, 200);
};
