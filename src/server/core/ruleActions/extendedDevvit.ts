import { context } from "@devvit/web/server";
import { T3 } from "@devvit/web/shared";
import { getExtendedDevvit } from "@fsvreddit/fsv-devvit-web-helpers";

export async function setContestMode (postId: T3, value: boolean) {
    try {
        await getExtendedDevvit().redditAPIPlugins.LinksAndComments.SetContestMode({
            id: postId,
            state: value,
        }, context.metadata);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to set contest mode for post ${postId}:`, message);
    }
}
