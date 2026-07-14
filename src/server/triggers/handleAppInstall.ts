import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { configureCronJobs } from "../core";

export const handleAppInstall = async (c: Context) => {
    console.log(`App Installed on version ${context.appVersion}`);

    await configureCronJobs();

    return c.json<TriggerResponse>({ message: "app install handled" }, 200);
};
