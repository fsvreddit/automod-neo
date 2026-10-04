import { context, reddit, redis, WikiPage } from "@devvit/web/server";
import { addHours } from "date-fns";

interface AbuseProtections {
    disallowedSubreddits: string[];
    disallowedReplyRegexes: RegExp[];
};

async function getAbuseProtectionData (): Promise<AbuseProtections> {
    const cacheKey = "abuseProtectionData";
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        return JSON.parse(cachedData) as AbuseProtections;
    }

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage("fsvapps", "automod-neo-settings");
    } catch (error) {
        console.error("Failed to fetch abuse protection wiki page:", error);
        return {
            disallowedSubreddits: [],
            disallowedReplyRegexes: [],
        };
    }

    let abuseProtectionData: AbuseProtections | undefined;
    try {
        abuseProtectionData = JSON.parse(wikiPage.content) as AbuseProtections;
    } catch (error) {
        console.error("Failed to parse abuse protection data:", error);
        return {
            disallowedSubreddits: [],
            disallowedReplyRegexes: [],
        };
    }

    await redis.set(cacheKey, JSON.stringify(abuseProtectionData), { expiration: addHours(new Date(), 1) });
    return abuseProtectionData;
}

export async function isInDisallowedSubreddit (): Promise<boolean> {
    const abuseProtectionData = await getAbuseProtectionData();
    const disallowedSubs = new Set(abuseProtectionData.disallowedSubreddits);
    return disallowedSubs.has(context.subredditName);
}

export async function isDisallowedReply (reply: string): Promise<boolean> {
    const abuseProtectionData = await getAbuseProtectionData();
    try {
        abuseProtectionData.disallowedReplyRegexes = abuseProtectionData.disallowedReplyRegexes.map(regex => new RegExp(regex));
        return abuseProtectionData.disallowedReplyRegexes.some(regex => regex.test(reply));
    } catch (error) {
        console.error("Failed to test disallowed reply regexes:", error);
        return false;
    }
}
