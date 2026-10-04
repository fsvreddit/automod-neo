import { scheduler, settings } from "@devvit/web/server";
import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { AppSetting, clearCachedRules, isInDisallowedSubreddit, parseRules, saveUnparsedRules, SchedulerJob } from "../core";
import pluralize from "pluralize";

export const validateAutomodSetting = async (c: Context) => {
    if (await isInDisallowedSubreddit()) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "This subreddit is not currently permitted to use Automod Neo.",
        });
    }

    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        await clearCachedRules();
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    const redosCheckerEnabled = await settings.get<boolean>(AppSetting.RedosCheckerEnabled) ?? true;

    try {
        const rules = parseRules(validationRequest.value, redosCheckerEnabled);
        console.log(`Parsed ${rules.length} ${pluralize("rule", rules.length)} successfully.`);
    } catch (e) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: (e as Error).message,
        });
    }

    await clearCachedRules();
    await saveUnparsedRules(validationRequest.value);

    await scheduler.runJob({
        name: SchedulerJob.CacheRules,
        runAt: new Date(),
    });

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
