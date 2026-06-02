import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";

export const handleAppInstall = (c: Context) => {
    console.log(`App Installed on version ${context.appVersion}`);
    return c.json<TriggerResponse>({ message: "app install handled" }, 200);
};
