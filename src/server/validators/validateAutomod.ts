import { scheduler } from "@devvit/web/server";
import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearCachedRules, parseRules, saveUnparsedRules, SchedulerJob } from "../core";
import pluralize from "pluralize";

export const validateAutomodSetting = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        await clearCachedRules();
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    try {
        const rules = parseRules(validationRequest.value);
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
