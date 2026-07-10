/* eslint-disable camelcase */
import { Comment, context, Post, PostSuggestedCommentSort, reddit, settings } from "@devvit/web/server";
import { isT1, isT3, T1, T3 } from "@devvit/web/shared";
import { AutomodMatch, CommentAction, PostOrCommentCondition, SetFlairActionDictionary } from "../types";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getBotCommentFooter, getDomainFromUrl, sendMessageToWebhook } from "../helpers";
import { AppSetting } from "../appSettings";
import markdownEscape from "markdown-escape";

interface AdditionalPlaceholders {
    author_flair_text?: string;
    author_flair_css_class?: string;
    media_author?: string;
    media_author_url?: string;
    media_title?: string;
    media_description?: string;
}

export function valueWithPlaceholdersReplaced (input: string | undefined, target: Post | Comment, additionalPlaceholders: AdditionalPlaceholders, automodMatch: AutomodMatch): string | undefined {
    if (!input) {
        return;
    }

    const body = target.body ?? "";
    const blockquotedBody = body
        ? body
                .split("\n")
                .map(line => `> ${markdownEscape(line)}`)
                .join("\n")
        : "";

    let result = input
        .replace(/(^|\n)>\s*{{body}}(?=\n|$)/g, (_, prefix: string) => `${prefix}${blockquotedBody}`)
        .replaceAll("u/{{author}}", `u/${target.authorName}`)
        .replaceAll("{{author}}", markdownEscape(target.authorName))
        .replaceAll("{{body}}", markdownEscape(body))
        .replaceAll("{{permalink}}", `https://www.reddit.com${target.permalink}`)
        .replaceAll("{{title}}", "title" in target ? markdownEscape(target.title) : "")
        .replaceAll("r/{{subreddit}}", `r/${target.subredditName}`)
        .replaceAll("{{subreddit}}", markdownEscape(target.subredditName))
        .replaceAll("{{kind}}", isT3(target.id) ? "submission" : "comment")
        .replaceAll("{{domain}}", getDomainFromUrl(target.url) ?? "")
        .replaceAll("{{url}}", target.url)
        .replaceAll("{{media_author}}", additionalPlaceholders.media_author ?? "")
        .replaceAll("{{media_author_url}}", additionalPlaceholders.media_author_url ?? "")
        .replaceAll("{{media_title}}", additionalPlaceholders.media_title ?? "")
        .replaceAll("{{media_description}}", additionalPlaceholders.media_description ?? "")
        .replaceAll("{{author_flair_text}}", additionalPlaceholders.author_flair_text ?? "")
        .replaceAll("{{author_flair_css_class}}", additionalPlaceholders.author_flair_css_class ?? "")
        .replaceAll("{{friendly_name}}", automodMatch.rule.friendly_name ?? "Unnamed rule")
        // {{match}} is replaced with the first match of the first category, or an empty string if there are no matches
        .replaceAll("{{match}}", automodMatch.matches[0]?.matches[0] ?? "");

    const matchRegex = /{{match(-\w+)?(\d+)?}}/g;
    for (const match of result.matchAll(matchRegex)) {
        const [fullMatch, category, index] = match;
        const categoryMatches = automodMatch.matches.find(m => m.category === category);
        if (!categoryMatches) {
            const indexToUse = index ? parseInt(index) - 1 : 0;
            result = result.replaceAll(fullMatch, automodMatch.matches[indexToUse]?.matches[0] ?? "");
        }
    }

    return result;
}

function getFlairOptions (flair: string | string[] | SetFlairActionDictionary, target: Post | Comment, automodMatch: AutomodMatch) {
    if (typeof flair === "string") {
        return {
            text: valueWithPlaceholdersReplaced(flair, target, {}, automodMatch),
        };
    } else if (Array.isArray(flair)) {
        return {
            text: valueWithPlaceholdersReplaced(flair[0], target, {}, automodMatch),
            cssClass: valueWithPlaceholdersReplaced(flair[1], target, {}, automodMatch),
        };
    } else {
        return {
            text: valueWithPlaceholdersReplaced(flair.text, target, {}, automodMatch),
            cssClass: valueWithPlaceholdersReplaced(flair.css_class, target, {}, automodMatch),
            templateId: flair.template_id,
        };
    }
}

async function doTopLevelAction (target: Post | Comment, additionalPlaceholders: AdditionalPlaceholders, action: PostOrCommentCondition | CommentAction, automodMatch: AutomodMatch) {
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
            const reportReason = valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, additionalPlaceholders, automodMatch);
            await reddit.report(target, { reason: reportReason ?? "Reported by Automod Neo" });
            break;
        }
        case "spam": {
            await target.remove(true);
            break;
        }
        case "filter": {
            const reportReason = valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, additionalPlaceholders, automodMatch);
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
    let additionalPlaceholders: AdditionalPlaceholders;
    if (isT3(target.id)) {
        const postTarget = target as Post;
        additionalPlaceholders = {
            media_author: postTarget.secureMedia?.oembed?.authorName,
            media_author_url: postTarget.secureMedia?.oembed?.authorUrl,
            media_title: postTarget.secureMedia?.oembed?.title,
            media_description: postTarget.secureMedia?.oembed?.html,
        };
    } else {
        additionalPlaceholders = {};
    }

    try {
        const targetAuthorFlair = await reddit.getUserByUsername(target.authorName).then(user => user?.getUserFlairBySubreddit(context.subredditName));
        if (targetAuthorFlair) {
            additionalPlaceholders.author_flair_text = targetAuthorFlair.flairText;
            additionalPlaceholders.author_flair_css_class = targetAuthorFlair.flairCssClass;
        }
    } catch {
        // Ignore errors when fetching author flair, as it is not critical to the action execution.
        console.error(`Failed to fetch author flair for ${target.authorName}`);
    }

    await doTopLevelAction(target, additionalPlaceholders, matchedRule.rule, matchedRule);

    if (matchedRule.rule.comment) {
        const commentBody = valueWithPlaceholdersReplaced(matchedRule.rule.comment, target, additionalPlaceholders, matchedRule);
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
            const flairOptions = getFlairOptions(matchedRule.rule.author.set_flair, target, matchedRule);
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
            await actionRulesForPost(parentPost, additionalPlaceholders, matchedRule.rule.parent_submission, matchedRule);
        }
    }

    if (doMessages && matchedRule.rule.message) {
        const messageBody = valueWithPlaceholdersReplaced(matchedRule.rule.message, target, additionalPlaceholders, matchedRule);
        const messageSubject = valueWithPlaceholdersReplaced(matchedRule.rule.message_subject, target, additionalPlaceholders, matchedRule) ?? "Automod Neo Notification";
        if (messageBody) {
            await reddit.sendPrivateMessage({
                to: target.authorName,
                subject: messageSubject,
                text: messageBody + "\n\n" + getBotCommentFooter(),
            });
        }
    }

    if (doMessages && matchedRule.rule.modmail) {
        const modmailBody = valueWithPlaceholdersReplaced(matchedRule.rule.modmail, target, additionalPlaceholders, matchedRule);
        const modmailSubject = valueWithPlaceholdersReplaced(matchedRule.rule.modmail_subject, target, additionalPlaceholders, matchedRule) ?? "Automod Neo Notification";
        if (modmailBody) {
            await reddit.modMail.createModInboxConversation({
                subredditId: context.subredditId,
                subject: modmailSubject,
                bodyMarkdown: modmailBody + "\n\n" + getBotCommentFooter(),
            });
        }
    }

    if (doMessages && matchedRule.rule.discord_alert) {
        const discordAlertBody = valueWithPlaceholdersReplaced(matchedRule.rule.discord_alert, target, additionalPlaceholders, matchedRule);
        const webhookUrl = await settings.get<string>(AppSetting.DiscordWebhookUrl);
        if (discordAlertBody) {
            if (webhookUrl) {
                await sendMessageToWebhook(webhookUrl, discordAlertBody);
            } else {
                console.warn("Discord alert specified in rule, but no webhook URL is set in subreddit settings.");
            }
        }
    }

    if (matchedRule.rule.set_locked) {
        await target.lock();
    }

    if (!("title" in target)) {
        return;
    }

    // Post only actions from this point.
    await actionRulesForPost(target, additionalPlaceholders, matchedRule.rule, matchedRule);
}

async function actionRulesForPost (post: Post, additionalPlaceholders: AdditionalPlaceholders, actions: PostOrCommentCondition, automodMatch: AutomodMatch): Promise<void> {
    await doTopLevelAction(post, additionalPlaceholders, actions, automodMatch);

    if (actions.set_flair) {
        if (!post.flair || actions.overwrite_flair) {
            const flairOptions = getFlairOptions(actions.set_flair, post, automodMatch);
            await reddit.setPostFlair({
                subredditName: context.subredditName,
                postId: post.id,
                text: flairOptions.text,
                cssClass: flairOptions.cssClass,
                flairTemplateId: flairOptions.templateId,
            });
        }
    }

    if (actions.set_sticky !== undefined) {
        if (actions.set_sticky) {
            await post.sticky(typeof actions.set_sticky === "number" ? actions.set_sticky : undefined);
        } else {
            await post.unsticky();
        }
    }

    if (actions.set_nsfw !== undefined) {
        if (actions.set_nsfw) {
            await post.markAsNsfw();
        } else {
            await post.unmarkAsNsfw();
        }
    }

    if (actions.set_spoiler !== undefined) {
        if (actions.set_spoiler) {
            await post.markAsSpoiler();
        } else {
            await post.unmarkAsSpoiler();
        }
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
