import { OnCommentCreateRequest, T1, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { actionRules } from "../core/ruleActions/actionRules";
import { fixCommentTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { AutomodRuleChecker, getRulesForSubreddit } from "../core/ruleExecution";

export const handleCommentSubmit = async (c: Context) => {
    const request = await fixCommentTriggerEvent(await c.req.json<OnCommentCreateRequest>());
    if (!request.comment) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no comment in request" }, 200);
    }

    const rules = await getRulesForSubreddit();
    const ruleChecker = new AutomodRuleChecker({ rules });

    const result = await ruleChecker.checkComment(request.comment.id as T1);

    if (!result) {
        return c.json<TriggerResponse>({ message: "comment submit handled, no matches found" }, 200);
    }

    await actionRules(request.comment.id, result);

    return c.json<TriggerResponse>({ message: "comment submit handled" }, 200);
};
