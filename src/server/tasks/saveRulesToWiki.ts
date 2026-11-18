import { context, reddit, TaskRequest, TaskResponse, WikiPage } from "@devvit/web/server";
import type { Context } from "hono";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addHours } from "date-fns";

export type SaveRulesToWikiJobData = {
    jobGuid: string;
    username?: string;
    rules: string;
};

export const handleSaveRulesToWikiJob = async (c: Context) => {
    const request = await c.req.json<TaskRequest<SaveRulesToWikiJobData>>();

    if (await hasEventBeenHandled(`job:${request.data.jobGuid}`, { expiration: addHours(new Date(), 1) })) {
        console.log(`Job ${request.data.jobGuid} has already been handled. Skipping.`);
        return c.json<TaskResponse>({ message: "job already handled" }, 200);
    }

    const wikiPageName = "automod-neo-backup";

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(context.subredditName, wikiPageName);
    } catch {
        // Page does not exist yet.
    }

    await reddit.updateWikiPage({
        subredditName: context.subredditName,
        page: wikiPageName,
        content: request.data.rules,
        reason: `Updated after edit by ${request.data.username ?? "an unknown user"}`,
    });

    if (!wikiPage) {
        await reddit.updateWikiPageSettings({
            subredditName: context.subredditName,
            page: wikiPageName,
            listed: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
            permLevel: 2, // MODS_ONLY
        });
    }

    return c.json<TaskResponse>({ message: "save rules to wiki job completed" }, 200);
};
