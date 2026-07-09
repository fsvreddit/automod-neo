import { Comment, context, Post, PostSuggestedCommentSort, reddit, settings } from "@devvit/web/server";
import { isT1, T1, T3 } from "@devvit/web/shared";
import { AutomodMatch, CommentAction, Matches, PostOrCommentCondition, SetFlairActionDictionary } from "../types";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getBotCommentFooter, getDomainFromUrl } from "../helpers";
import { AppSetting } from "../appSettings";

interface PlaceholderTarget {
    authorName: string;
    body?: string;
    permalink: string;
    subredditName: string;
    url: string;
    title?: string;
}

export function valueWithPlaceholdersReplaced (input: string | undefined, target: PlaceholderTarget, matches: Matches[]): string | undefined {
    if (!input) {
        return;
    }

    const body = target.body ?? "";
    const blockquotedBody = body
        ? body
                .split("\n")
                .map(line => `> ${line}`)
                .join("\n")
        : "";

    // If body is used in blockquote placeholder form, blockquote every body line.
    let result = input
        .replace(/(^|\n)>\s*{{body}}(?=\n|$)/g, `$1${blockquotedBody}`)
        .replaceAll("{{author}}", target.authorName)
        .replaceAll("{{body}}", body)
        .replaceAll("{{permalink}}", `https://www.reddit.com${target.permalink}`)
        .replaceAll("{{title}}", target.title ?? "")
        .replaceAll("{{subreddit}}", target.subredditName)
        .replaceAll("{{kind}}", target.title === undefined ? "comment" : "post")
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

function getFlairOptions (flair: string | string[] | SetFlairActionDictionary, target: PlaceholderTarget, matches: Matches[]) {
    if (typeof flair === "string") {
        return {
            text: valueWithPlaceholdersReplaced(flair, target, matches),
        };
    } else if (Array.isArray(flair)) {
        return {
            text: valueWithPlaceholdersReplaced(flair[0], target, matches),
            cssClass: valueWithPlaceholdersReplaced(flair[1], target, matches),
        };
    } else {
        return {
            text: valueWithPlaceholdersReplaced(flair.text, target, matches),
            cssClass: valueWithPlaceholdersReplaced(flair.css_class, target, matches),
            templateId: flair.template_id,
        };
    }
}

async function doTopLevelAction (target: Post | Comment, action: PostOrCommentCondition | CommentAction, matches: Matches[]) {
    if (!action.action) {
        return;
    }

    switch (action.action) {
        case "remove": {
            await target.remove();
            break;
        }
        case "approve": {
            await target.approve();
            break;
        }
        case "report": {
            const reportReason = valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, matches);
            await reddit.report(target, { reason: reportReason ?? "Reported by Automod2" });
            break;
        }
        case "spam": {
            await target.remove(true);
            break;
        }
        case "filter": {
            const reportReason = valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, matches);
            await target.filter({
                reason: reportReason ?? "Filtered by Automod Neo",
                keep: false,
            });
            break;
        }
        default: {
            console.warn(`Unknown action: ${action.action}`);
        }
    }
}
export async function actionRules (targetId: string, matchedRule: AutomodMatch, doMessages = true): Promise<void> {
    console.log(`Applying actions on target ${targetId}`);

    const target = await getPostOrCommentById(targetId as T1 | T3);

    await doTopLevelAction(target, matchedRule.rule, matchedRule.matches);

    if (matchedRule.rule.comment) {
        const commentBody = valueWithPlaceholdersReplaced(matchedRule.rule.comment, target, matchedRule.matches);
        if (commentBody) {
            const newComment = await reddit.submitComment({
                id: target.id,
                text: commentBody + "\n\n" + getBotCommentFooter(),
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
            const flairOptions = getFlairOptions(matchedRule.rule.author.set_flair, target, matchedRule.matches);
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
        const parentSubmissionRules = matchedRule.rule.parent_submission;
        if (parentSubmissionRules.action || parentSubmissionRules.set_flair || parentSubmissionRules.set_sticky || parentSubmissionRules.set_nsfw || parentSubmissionRules.set_spoiler || parentSubmissionRules.set_suggested_sort || parentSubmissionRules.set_post_crowd_control_level) {
            const parentPost = await reddit.getPostById(target.postId);
            await actionRulesForPost(parentPost, matchedRule.rule.parent_submission, matchedRule.matches);
        }
    }

    if (doMessages && matchedRule.rule.message) {
        const messageBody = valueWithPlaceholdersReplaced(matchedRule.rule.message, target, matchedRule.matches);
        const messageSubject = valueWithPlaceholdersReplaced(matchedRule.rule.message_subject, target, matchedRule.matches) ?? "Message from Automod2";
        if (messageBody) {
            await reddit.sendPrivateMessage({
                to: target.authorName,
                subject: messageSubject,
                text: messageBody + "\n\n" + getBotCommentFooter(),
            });
        }
    }

    if (doMessages && matchedRule.rule.modmail) {
        const modmailBody = valueWithPlaceholdersReplaced(matchedRule.rule.modmail, target, matchedRule.matches);
        const modmailSubject = valueWithPlaceholdersReplaced(matchedRule.rule.modmail_subject, target, matchedRule.matches) ?? "Modmail from Automod2";
        if (modmailBody) {
            await reddit.modMail.createModInboxConversation({
                subredditId: context.subredditId,
                subject: modmailSubject,
                bodyMarkdown: modmailBody + "\n\n" + getBotCommentFooter(),
            });
        }
    }

    if (doMessages && matchedRule.rule.discord_alert) {
        const discordAlertBody = valueWithPlaceholdersReplaced(matchedRule.rule.discord_alert, target, matchedRule.matches);
        const webhookUrl = await settings.get<string>(AppSetting.DiscordWebhookUrl);
        if (discordAlertBody && webhookUrl) {
            await sendMessageToWebhook(webhookUrl, discordAlertBody);
        }
    }

    if (matchedRule.rule.set_locked) {
        await target.lock();
    }

    if (!("title" in target)) {
        return;
    }

    // Post only actions from this point.
    await actionRulesForPost(target, matchedRule.rule, matchedRule.matches);
}

async function actionRulesForPost (post: Post, actions: PostOrCommentCondition, matches: Matches[]) {
    await doTopLevelAction(post, actions, matches);

    if (actions.set_flair) {
        if (!post.flair || actions.overwrite_flair) {
            const flairOptions = getFlairOptions(actions.set_flair, post, matches);
            await reddit.setPostFlair({
                subredditName: context.subredditName,
                postId: post.id,
                text: flairOptions.text,
                cssClass: flairOptions.cssClass,
                flairTemplateId: flairOptions.templateId,
            });
        }
    }

    if (actions.set_sticky) {
        await post.sticky(typeof actions.set_sticky === "number" ? actions.set_sticky : undefined);
    }

    if (actions.set_nsfw) {
        await post.markAsNsfw();
    }

    if (actions.set_spoiler) {
        await post.markAsSpoiler();
    }

    if (actions.set_suggested_sort) {
        let suggestedSort: PostSuggestedCommentSort;
        switch (actions.set_suggested_sort) {
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
                console.warn(`Unknown suggested sort: ${actions.set_suggested_sort}`);
                return;
        }
        await post.setSuggestedCommentSort(suggestedSort);
    }

    if (actions.set_post_crowd_control_level) {
        await post.updateCrowdControlLevel(actions.set_post_crowd_control_level);
    }
}
