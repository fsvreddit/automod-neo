import { TaskRequest, TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { CommentQueueJobData, processCommentQueue } from "../core";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addHours } from "date-fns";

export const handleProcessCommentQueue = async (c: Context) => {
    const request = await c.req.json<TaskRequest<CommentQueueJobData>>();

    if (await hasTriggerBeenHandled(`job:${request.data.jobGuid}`, { expiration: addHours(new Date(), 1) })) {
        console.log(`Job ${request.data.jobGuid} has already been handled. Skipping.`);
        return c.json<TaskResponse>({ message: "job already handled" }, 200);
    }

    await processCommentQueue(request.data.jobGuid);

    return c.json<TaskResponse>({ message: "process comment queue job completed" }, 200);
};
