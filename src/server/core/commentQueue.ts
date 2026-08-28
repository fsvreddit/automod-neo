import { reddit, redis, scheduler, settings } from "@devvit/web/server";
import { isT3, T1, T3 } from "@devvit/web/shared";
import { AppSetting, CommentToAdd, getBotCommentFooter, SchedulerJob } from ".";
import { addDays, addMonths, addSeconds } from "date-fns";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";

const COMMENT_QUEUE_KEY = "commentQueue";

interface CommentQueueItem {
    targetId: T1 | T3;
    commentToAdd: CommentToAdd;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type CommentQueueJobData = {
    jobGuid: string;
};

function getCommentQueueKey (queuedCommentKey: string): string {
    return `queuedComment:${queuedCommentKey}`;
}

async function queueComment (queueItem: CommentQueueItem) {
    const key = crypto.randomUUID();

    await redis.set(getCommentQueueKey(key), JSON.stringify(queueItem), { expiration: addDays(new Date(), 1) });
    await redis.zAdd(COMMENT_QUEUE_KEY, { member: key, score: Date.now() });
}

async function queueCommentsForTarget (targetId: T1 | T3, commentsToAdd: CommentToAdd[]): Promise<void> {
    const combineComments = await settings.get<boolean>(AppSetting.CombineComments);

    const firstComment = commentsToAdd[0];
    if (!firstComment) {
        console.log(`No comments to add for target ${targetId}. Skipping.`);
        return;
    }

    if (combineComments) {
        const combinedComments = commentsToAdd.map(comment => comment.text.trim()).join("\n\n---\n\n");
        const value = {
            targetId,
            commentToAdd: {
                ruleName: firstComment.ruleName,
                text: combinedComments,
                shouldLock: commentsToAdd.some(comment => comment.shouldLock),
                shouldSticky: commentsToAdd.some(comment => comment.shouldSticky),
            },
        } satisfies CommentQueueItem;

        await queueComment(value);
    } else {
        for (const comment of commentsToAdd) {
            const value = {
                targetId,
                commentToAdd: comment,
            } satisfies CommentQueueItem;

            await queueComment(value);
        }
    }
}

export async function queueComments (comments: Record<T1 | T3, CommentToAdd[]>): Promise<void> {
    for (const [targetId, commentsToAdd] of Object.entries(comments)) {
        await queueCommentsForTarget(targetId as T1 | T3, commentsToAdd);
    }

    await queueNextCommentQueueJob();
}

async function queueNextCommentQueueJob (source?: string, delaySeconds = 0) {
    const existingJobs = await scheduler.listJobs()
        .then(jobs => jobs.filter(job => job.name === SchedulerJob.ProcessCommentQueue as string && job.data?.jobGuid !== source));

    if (existingJobs.length > 0) {
        console.log(`A ${SchedulerJob.ProcessCommentQueue} job is already scheduled. Skipping scheduling a new one.`);
        return;
    }

    await scheduler.runJob({
        name: SchedulerJob.ProcessCommentQueue,
        data: { jobGuid: crypto.randomUUID() } satisfies CommentQueueJobData,
        runAt: addSeconds(new Date(), delaySeconds),
    });
}

export async function processCommentQueue (jobGuid: string) {
    const commentQueue = await redis.zRange(COMMENT_QUEUE_KEY, 0, -1).then(items => items.map(item => item.member));

    const firstCommentKey = commentQueue.shift();
    if (!firstCommentKey) {
        console.log("Comment Queue: No comments in the queue to process.");
        return;
    }

    const commentQueueItemJson = await redis.get(getCommentQueueKey(firstCommentKey));
    if (!commentQueueItemJson) {
        console.log(`Comment Queue: No comment queue item found for key ${firstCommentKey}.`);
        await redis.zRem(COMMENT_QUEUE_KEY, [firstCommentKey]);
        await queueNextCommentQueueJob(jobGuid, 0);
        return;
    }

    const commentQueueItem = JSON.parse(commentQueueItemJson) as CommentQueueItem;
    await submitComment(commentQueueItem);
    await redis.zRem(COMMENT_QUEUE_KEY, [firstCommentKey]);
    await redis.del(getCommentQueueKey(firstCommentKey));

    await queueNextCommentQueueJob(jobGuid, 10);
}

async function submitComment (commentQueueItem: CommentQueueItem) {
    const commentSubmittedKey = `commentSubmitted:${commentQueueItem.targetId}`;
    const commentAlreadySubmitted = await redis.get(commentSubmittedKey);

    const parsedComments = JSON.parse(commentAlreadySubmitted ?? "[]") as string[];
    if (parsedComments.includes(commentQueueItem.commentToAdd.text)) {
        console.log(`Skipping comment submission for target ${commentQueueItem.targetId} because the same comment has already been submitted.`);
        return;
    }

    try {
        const target = await getPostOrCommentById(commentQueueItem.targetId);
        const newComment = await reddit.submitComment({
            id: commentQueueItem.targetId,
            text: commentQueueItem.commentToAdd.text + "\n\n" + getBotCommentFooter(target),
        });
        parsedComments.push(commentQueueItem.commentToAdd.text);
        await redis.set(commentSubmittedKey, JSON.stringify(parsedComments), { expiration: addMonths(new Date(), 1) });
        console.log(`Successfully submitted comment for target ${commentQueueItem.targetId}.`);

        if (commentQueueItem.commentToAdd.shouldLock) {
            await newComment.lock();
            console.log(`Locked comment on target ${commentQueueItem.targetId}.`);
        }

        await newComment.distinguish(commentQueueItem.commentToAdd.shouldSticky && isT3(commentQueueItem.targetId));
        console.log(`Distinguished comment on target ${commentQueueItem.targetId}.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to submit comment for target ${commentQueueItem.targetId}:`, message);
    }
}
