import { TaskResponse, TaskRequest } from "@devvit/web/server";
import type { Context } from "hono";
import { clearCachedRules, getRulesForSubreddit } from "../core";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addHours } from "date-fns";

export type CacheRulesJobData = {
    jobGuid: string;
};

export const handleCacheRules = async (c: Context) => {
    const request = await c.req.json<TaskRequest<CacheRulesJobData>>();
    if (await hasEventBeenHandled(`job:${request.data.jobGuid}`, { expiration: addHours(new Date(), 1) })) {
        console.log(`Job ${request.data.jobGuid} has already been handled. Skipping.`);
        return c.json<TaskResponse>({ message: "job already handled" }, 200);
    }

    await clearCachedRules();
    await getRulesForSubreddit();

    return c.json<TaskResponse>({ message: "cache rules job completed" }, 200);
};
