import { context, scheduler } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearCachedRules, configureCronJobs, SchedulerJob } from "../core";
import { addSeconds } from "date-fns";

export const handleAppUpgrade = async (c: Context) => {
    console.log(`App upgraded to version ${context.appVersion}`);

    await clearCachedRules();

    await configureCronJobs();

    await scheduler.runJob({
        name: SchedulerJob.CacheRules,
        runAt: addSeconds(new Date(), 10),
    });

    console.log(`Automod Neo updated to version ${context.appVersion}.`);

    return c.json<TriggerResponse>({ message: "app upgrade handled" }, 200);
};
