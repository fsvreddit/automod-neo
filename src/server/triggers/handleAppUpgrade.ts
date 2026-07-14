import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearCachedRules } from "../core/ruleExecution";
import { configureCronJobs } from "../core";

export const handleAppUpgrade = async (c: Context) => {
    console.log(`App upgraded to version ${context.appVersion}`);

    await clearCachedRules();

    await configureCronJobs();

    return c.json<TriggerResponse>({ message: "app upgrade handled" }, 200);
};
