import { context, reddit, redis } from "@devvit/web/server";
import { addWeeks } from "date-fns";
import { AutomodRule } from "./types";

export function getBotCommentFooter (): string {
    return `*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${context.subredditName}) if you have any questions or concerns.*`;
}

function getApprovedUserCacheKey (username: string): string {
    return `isApprovedUser:${username}`;
}

function getModeratorCacheKey (username: string): string {
    return `isModerator:${username}`;
}

export async function isApprovedUser (username: string): Promise<boolean> {
    const cacheKey = getApprovedUserCacheKey(username);
    const cachedValue = await redis.get(cacheKey);

    if (cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const approvedUsers = await reddit.getApprovedUsers({
        subredditName: context.subredditName,
        username,
    }).all();

    const isUserSubmitter = approvedUsers.length > 0;
    await redis.set(cacheKey, JSON.stringify(isUserSubmitter), { expiration: addWeeks(new Date(), 1) }); // Cache for 1 week

    return isUserSubmitter;
}

export async function isModerator (username: string): Promise<boolean> {
    const cacheKey = getModeratorCacheKey(username);
    const cachedValue = await redis.get(cacheKey);

    if (cachedValue !== undefined) {
        return JSON.parse(cachedValue) as boolean;
    }

    const moderators = await reddit.getModerators({
        subredditName: context.subredditName,
        username,
    }).all();

    const isUserModerator = moderators.length > 0;
    await redis.set(cacheKey, JSON.stringify(isUserModerator), { expiration: addWeeks(new Date(), 1) }); // Cache for 1 week

    return isUserModerator;
}

export async function clearUserRoleCache (username: string): Promise<void> {
    await redis.del(getApprovedUserCacheKey(username), getModeratorCacheKey(username));
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

export async function sendMessageToWebhook (webhookUrl: string, message: string) {
    let params;
    if (webhookUrl.includes("discord.com")) {
        params = {
            content: message,
        };
    } else {
        params = {
            text: message,
        };
    }

    try {
        const result = await fetch(
            webhookUrl,
            {
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            },
        );

        if (!result.ok) {
            const responseBody = await result.text();
            console.error(`Webhook send failed with status ${result.status}:`, responseBody);
            return;
        }

        console.log("Webhook message sent, status:", result.status);
    } catch (error) {
        console.error("Error sending message to webhook:", error);
    }
}

export function isUserIgnoredForTriggers (username: string): boolean {
    const ignoredUsernames = new Set([
        context.appSlug,
        "AutoModerator",
        `${context.subredditName}-ModTeam`,
    ]);

    return ignoredUsernames.has(username);
}

export function isRemovalRule (rule: AutomodRule): boolean {
    return rule.action === "remove" || rule.action === "spam" || rule.action === "filter";
}
