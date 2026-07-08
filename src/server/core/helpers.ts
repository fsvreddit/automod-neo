import { context, reddit, redis, User } from "@devvit/web/server";
import { addWeeks } from "date-fns";

export function getBotCommentFooter (): string {
    return `*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/r/${context.subredditName}/about/moderators) if you have any questions or concerns.*`;
}

function getApprovedUserCacheKey (userId: string): string {
    return `isApprovedUser:${userId}`;
}

function getModeratorCacheKey (userId: string): string {
    return `isModerator:${userId}`;
}

export async function isApprovedUser (user: User): Promise<boolean> {
    const cacheKey = getApprovedUserCacheKey(user.id);
    const cachedValue = await redis.get(cacheKey);

    if (cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const approvedUsers = await reddit.getApprovedUsers({
        subredditName: context.subredditName,
        username: user.username,
    }).all();

    const isUserSubmitter = approvedUsers.length > 0;
    await redis.set(cacheKey, JSON.stringify(isUserSubmitter), { expiration: addWeeks(new Date(), 1) }); // Cache for 1 week

    return isUserSubmitter;
}

export async function isModerator (user: User): Promise<boolean> {
    const cacheKey = getModeratorCacheKey(user.id);
    const cachedValue = await redis.get(cacheKey);

    if (cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const moderators = await reddit.getModerators({
        subredditName: context.subredditName,
        username: user.username,
    }).all();

    const isUserModerator = moderators.length > 0;
    await redis.set(cacheKey, JSON.stringify(isUserModerator), { expiration: addWeeks(new Date(), 1) }); // Cache for 1 week

    return isUserModerator;
}

export async function clearUserRoleCache (userId: string): Promise<void> {
    await redis.del(getApprovedUserCacheKey(userId), getModeratorCacheKey(userId));
}

export function normaliseTimestamp (timestamp: number): Date {
    if (new Date(timestamp) > new Date(1990, 0)) {
        return new Date(timestamp);
    } else {
        return new Date(timestamp * 1000);
    }
}

export function getDomainFromUrl (url: string): string | undefined {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.replace("www.", "");
    } catch {
        return undefined;
    }
}

export async function isSubredditNSFW (subredditName: string): Promise<boolean> {
    const cacheKey = `subredditNSFW:${subredditName}`;
    const cachedValue = await redis.get(cacheKey);

    if (cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const subreddit = await reddit.getSubredditInfoByName(subredditName);
    await redis.set(cacheKey, JSON.stringify(subreddit.isNsfw), { expiration: addWeeks(new Date(), 1) }); // Cache for 1 week

    return subreddit.isNsfw ?? false;
}

export function getTextWithoutBlockquotes (input: string): string {
    return input.split("\n").filter(line => !line.trim().startsWith(">")).join("\n").trim();
}
