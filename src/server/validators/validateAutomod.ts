import { reddit, scheduler } from "@devvit/web/server";
import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearCachedRules, isInDisallowedSubreddit, parseRules, saveUnparsedRules, SchedulerJob } from "../core";
import pluralize from "pluralize";
import { CacheRulesJobData, SaveRulesToWikiJobData } from "../tasks";

export const validateAutomodSetting = async (c: Context) => {
    if (await isInDisallowedSubreddit()) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "This subreddit is not currently permitted to use Automod Neo.",
        });
    }

    const { value } = await c.req.json<SettingsValidationRequest<string>>();

    if (!value) {
        await clearCachedRules();
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    try {
        const rules = parseRules(value);
        console.log(`Parsed ${rules.length} ${pluralize("rule", rules.length)} successfully.`);
    } catch (e) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: (e as Error).message,
        });
    }

    await clearCachedRules();
    await saveUnparsedRules(value);

    await scheduler.runJob<CacheRulesJobData>({
        name: SchedulerJob.CacheRules,
        runAt: new Date(),
        data: {
            jobGuid: crypto.randomUUID(),
        },
    });

    const currentUser = await reddit.getCurrentUser();
    await scheduler.runJob<SaveRulesToWikiJobData>({
        name: SchedulerJob.SaveRulesToWiki,
        runAt: new Date(),
        data: {
            jobGuid: crypto.randomUUID(),
            username: currentUser?.username,
            rules: value,
        },
    });

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
