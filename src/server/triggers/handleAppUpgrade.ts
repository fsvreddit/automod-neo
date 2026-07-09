import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { clearCachedRules } from "../core/ruleExecution";

export const handleAppUpgrade = async (c: Context) => {
    console.log(`App upgraded to version ${context.appVersion}`);

    await clearCachedRules();

    return c.json<TriggerResponse>({ message: "app upgrade handled" }, 200);
};
