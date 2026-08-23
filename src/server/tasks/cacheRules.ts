import { TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { clearCachedRules, getRulesForSubreddit } from "../core";

export const handleCacheRules = async (c: Context) => {
    await clearCachedRules();
    await getRulesForSubreddit();

    return c.json<TaskResponse>({ message: "cache rules job completed" }, 200);
};
