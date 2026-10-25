import { settings, TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { AppSetting, parseRules } from "../core";

export const handleRunParseWithReDoS = async (c: Context) => {
    const rules = await settings.get<string>(AppSetting.Rules);
    if (!rules) {
        return c.json<TaskResponse>({ message: "no rules found" }, 400);
    }

    try {
        await parseRules(rules, true);
    } catch (error) {
        return c.json<TaskResponse>({ message: `error occurred: ${error}` }, 500);
    }

    return c.json<TaskResponse>({ message: "run parse with ReDoS job completed" }, 200);
};
