import { Comment, context, Post, PostSuggestedCommentSort, reddit } from "@devvit/web/server";
import { isT1, T1, T3 } from "@devvit/web/shared";
import { AutomodMatch, Matches, SetFlairActionDictionary } from "../types";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getDomainFromUrl } from "../helpers";

function valueWithPlaceholdersReplaced (input: string | undefined, target: Post | Comment, matches: Matches[]): string | undefined {
    if (!input) {
        return;
    }

    let result = input
        .replaceAll("{{author}}", target.authorName)
        .replaceAll("{{body}}", target.body ?? "")
        .replaceAll("{{permalink}}", `https://www.reddit.com${target.permalink}`)
        .replaceAll("{{title}}", "title" in target ? target.title : "")
        .replaceAll("{{subreddit}}", target.subredditName)
        .replaceAll("{{kind}}", "title" in target ? "post" : "comment")
        .replaceAll("{{domain}}", getDomainFromUrl(target.url) ?? "")
        .replaceAll("{{url}}", target.url)
        // {{match}} is replaced with the first match of the first category, or an empty string if there are no matches
        .replaceAll("{{match}}", matches[0]?.matches[0] ?? "");

    const matchRegex = /{{match(-\w+)?(\d+)?}}/g;
    for (const match of result.matchAll(matchRegex)) {
        const [fullMatch, category, index] = match;
        const categoryMatches = matches.find(m => m.category === category);
        if (!categoryMatches) {
            const indexToUse = index ? parseInt(index) - 1 : 0;
            result = result.replaceAll(fullMatch, matches[indexToUse]?.matches[0] ?? "");
        }
    }

    return result;
}

function getFlairOptions (flair: string | string[] | SetFlairActionDictionary) {
    if (typeof flair === "string") {
        return {
            text: flair,
        };
    } else if (Array.isArray(flair)) {
        return {
            text: flair[0],
            cssClass: flair[1],
        };
    } else {
        return {
            text: flair.text,
            cssClass: flair.css_class,
            templateId: flair.template_id,
        };
    }
}

export async function actionRules (targetId: string, matchedRule: AutomodMatch): Promise<void> {
    console.log(`Applying actions on target ${targetId} for rule ${JSON.stringify(matchedRule.rule.id)}`);

    const target = await getPostOrCommentById(targetId as T1 | T3);

    switch (matchedRule.rule.action) {
        case "remove": {
            await target.remove();
            break;
        }
        case "approve": {
            await target.approve();
            break;
        }
        case "report": {
            const reportReason = valueWithPlaceholdersReplaced(matchedRule.rule.report_reason ?? matchedRule.rule.action_reason, target, matchedRule.matches);
            await reddit.report(target, { reason: reportReason ?? "Reported by Automod2" });
            break;
        }
        case "spam": {
            await target.remove(true);
            break;
        }
        case "filter": {
            const reportReason = valueWithPlaceholdersReplaced(matchedRule.rule.report_reason ?? matchedRule.rule.action_reason, target, matchedRule.matches);
            await target.filter(reportReason ?? "Filtered by Automod2", false);
            break;
        }
        default: {
            console.warn(`Unknown action: ${matchedRule.rule.action}`);
        }
    }

    if (matchedRule.rule.comment) {
        const commentBody = valueWithPlaceholdersReplaced(matchedRule.rule.comment, target, matchedRule.matches);
        if (commentBody) {
            const newComment = await reddit.submitComment({
                id: target.id,
                text: commentBody,
            });
            if (matchedRule.rule.comment_locked) {
                await newComment.lock();
            }
            await newComment.distinguish(matchedRule.rule.comment_stickied && isT1(targetId));
        }
    }

    if (matchedRule.rule.author?.set_flair) {
        const user = await reddit.getUserByUsername(target.authorName);
        const existingUserFlair = user?.getUserFlairBySubreddit(context.subredditName);
        if (matchedRule.rule.author.overwrite_flair || !existingUserFlair) {
            const flairOptions = getFlairOptions(matchedRule.rule.author.set_flair);
            await reddit.setUserFlair({
                subredditName: context.subredditName,
                username: target.authorName,
                text: flairOptions.text,
                cssClass: flairOptions.cssClass,
                flairTemplateId: flairOptions.templateId,
            });
        }
    }

    if (matchedRule.rule.parent_submission && "postId" in target) {
        await actionRules(target.postId, matchedRule);
    }

    if (!("title" in target)) {
        return;
    }

    // Post only actions from this point.

    if (matchedRule.rule.set_flair) {
        if (!target.flair || matchedRule.rule.overwrite_flair) {
            const flairOptions = getFlairOptions(matchedRule.rule.set_flair);
            await reddit.setPostFlair({
                subredditName: context.subredditName,
                postId: target.id,
                text: flairOptions.text,
                cssClass: flairOptions.cssClass,
                flairTemplateId: flairOptions.templateId,
            });
        }
    }

    if (matchedRule.rule.set_sticky) {
        await target.sticky(typeof matchedRule.rule.set_sticky === "number" ? matchedRule.rule.set_sticky : undefined);
    }

    if (matchedRule.rule.set_nsfw) {
        await target.markAsNsfw();
    }

    if (matchedRule.rule.set_spoiler) {
        await target.markAsSpoiler();
    }

    if (matchedRule.rule.set_locked) {
        await target.lock();
    }

    if (matchedRule.rule.set_suggested_sort) {
        let suggestedSort: PostSuggestedCommentSort;
        switch (matchedRule.rule.set_suggested_sort) {
            case "blank":
                suggestedSort = "BLANK";
                break;
            case "hot":
            case "best":
                suggestedSort = "CONFIDENCE";
                break;
            case "new":
                suggestedSort = "NEW";
                break;
            case "qa":
                suggestedSort = "QA";
                break;
            case "top":
                suggestedSort = "TOP";
                break;
            case "controversial":
                suggestedSort = "CONTROVERSIAL";
                break;
            case "old":
                suggestedSort = "OLD";
                break;
            case "random":
                suggestedSort = "RANDOM";
                break;
            default:
                console.warn(`Unknown suggested sort: ${matchedRule.rule.set_suggested_sort}`);
                return;
        }
        await target.setSuggestedCommentSort(suggestedSort);
    }
}
