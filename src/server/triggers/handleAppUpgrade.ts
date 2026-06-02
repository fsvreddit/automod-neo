import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";

export const handleAppUpgrade = (c: Context) => {
    console.log(`App upgraded to version ${context.appVersion}`);

    return c.json<TriggerResponse>({ message: "app upgrade handled" }, 200);
};
