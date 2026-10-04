import { context, reddit, redis, WikiPage } from "@devvit/web/server";
import { addHours } from "date-fns";

interface GlobalSettings {
    disallowedSubreddits: string[];
    disallowedReplyRegexes: RegExp[];
    redosDetectionExemptedSubs?: string[];
};

async function getGlobalSettings (): Promise<GlobalSettings> {
    const cacheKey = "globalSettings";
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        return JSON.parse(cachedData) as GlobalSettings;
    }

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage("fsvapps", "automod-neo-settings");
    } catch (error) {
        console.error("Failed to fetch global settings wiki page:", error);
        return {
            disallowedSubreddits: [],
            disallowedReplyRegexes: [],
            redosDetectionExemptedSubs: [],
        };
    }

    let abuseProtectionData: GlobalSettings | undefined;
    try {
        abuseProtectionData = JSON.parse(wikiPage.content) as GlobalSettings;
    } catch (error) {
        console.error("Failed to parse global settings data:", error);
        return {
            disallowedSubreddits: [],
            disallowedReplyRegexes: [],
            redosDetectionExemptedSubs: [],
        };
    }

    await redis.set(cacheKey, JSON.stringify(abuseProtectionData), { expiration: addHours(new Date(), 1) });
    return abuseProtectionData;
}

export async function isInDisallowedSubreddit (): Promise<boolean> {
    const globalSettings = await getGlobalSettings();
    const disallowedSubs = new Set(globalSettings.disallowedSubreddits);
    return disallowedSubs.has(context.subredditName);
}

export async function isDisallowedReply (reply: string): Promise<boolean> {
    const globalSettings = await getGlobalSettings();
    try {
        globalSettings.disallowedReplyRegexes = globalSettings.disallowedReplyRegexes.map(regex => new RegExp(regex));
        return globalSettings.disallowedReplyRegexes.some(regex => regex.test(reply));
    } catch (error) {
        console.error("Failed to test disallowed reply regexes:", error);
        return false;
    }
}

export async function isRedosDetectionExemptedSub (): Promise<boolean> {
    const globalSettings = await getGlobalSettings();
    const exemptedSubs = new Set(globalSettings.redosDetectionExemptedSubs ?? []);
    return exemptedSubs.has(context.subredditName);
}
