/* eslint-disable camelcase */
import { Comment, context, Post, PostSuggestedCommentSort, reddit, settings, User } from "@devvit/web/server";
import { isT1, isT3, T1, T3 } from "@devvit/web/shared";
import { AutomodMatch, CommentAction, PostOrCommentCondition, SetFlairActionDictionary } from "../types";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getBotCommentFooter, getDomainFromUrl, sendMessageToWebhook } from "../helpers";
import { AppSetting } from "../appSettings";
import markdownEscape from "markdown-escape";
import _ from "lodash";

interface AdditionalPlaceholders {
    author_flair_text?: string;
    author_flair_css_class?: string;
    media_author?: string;
    media_author_url?: string;
    media_title?: string;
}

interface CommentToAdd {
    ruleName: string;
    text: string;
    shouldLock: boolean;
    shouldSticky: boolean;
}

export class ActionRules {
    private targetId: T1 | T3;
    private matchedRules: AutomodMatch[];
    private additionalPlaceholders: AdditionalPlaceholders = {};
    private webhookUrl: string | undefined;

    private commentsToAdd: Record<T1 | T3, CommentToAdd[]> = {};

    private users: Record<string, User | undefined> = {};

    private async getUserByUsername (username: string): Promise<User | undefined> {
        if (!Object.keys(this.users).includes(username)) {
            try {
                this.users[username] = await reddit.getUserByUsername(username);
            } catch (error) {
                console.error(`Failed to get user by username: ${username}`, error);
            }
        }
        return this.users[username];
    }

    private posts: Record<string, Post> = {};

    private async getPostById (postId: T3): Promise<Post> {
        this.posts[postId] ??= await reddit.getPostById(postId);
        return this.posts[postId];
    }

    private addCommentToAdd (targetId: T1 | T3, comment: CommentToAdd) {
        this.commentsToAdd[targetId] ??= [];
        this.commentsToAdd[targetId].push(comment);
    }

    constructor (opts: {
        targetId: T1 | T3;
        matchedRules: AutomodMatch[];
        user?: User;
    }) {
        this.targetId = opts.targetId;
        this.matchedRules = opts.matchedRules;
        if (opts.user) {
            this.users[opts.user.username] = opts.user;
        }
    }

    public valueWithPlaceholdersReplaced (input: string | undefined, target: Post | Comment, automodMatch: AutomodMatch): string | undefined {
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
            .replaceAll("{{media_author}}", this.additionalPlaceholders.media_author ?? "")
            .replaceAll("{{media_author_url}}", this.additionalPlaceholders.media_author_url ?? "")
            .replaceAll("{{media_title}}", this.additionalPlaceholders.media_title ?? "")
            .replaceAll("{{author_flair_text}}", this.additionalPlaceholders.author_flair_text ?? "")
            .replaceAll("{{author_flair_css_class}}", this.additionalPlaceholders.author_flair_css_class ?? "")
            .replaceAll("{{friendly_name}}", automodMatch.rule.friendly_name ?? "Unnamed rule")
            // {{match}} is replaced with the first match of the first category, or an empty string if there are no matches
            .replaceAll("{{match}}", automodMatch.matches[0]?.matches[0] ?? "");

        const matchRegex = /{{match(?:-([a-z]+))?(?:-(\d+))?}}/g;
        for (const match of result.matchAll(matchRegex)) {
            // console.log(match);
            const [fullMatch, category, index] = match;
            const indexToUse = index ? parseInt(index) - 1 : 0;
            const categoryMatch = automodMatch.matches.find(m => m.category === category);
            if (categoryMatch) {
                result = result.replaceAll(fullMatch, categoryMatch.matches[indexToUse] ?? "");
            } else {
                result = result.replaceAll(fullMatch, automodMatch.matches[0]?.matches[indexToUse] ?? "");
            }
        }

        return result;
    }

    private getFlairOptions (flair: string | string[] | SetFlairActionDictionary, target: Post | Comment, automodMatch: AutomodMatch) {
        if (typeof flair === "string") {
            return {
                text: this.valueWithPlaceholdersReplaced(flair, target, automodMatch),
            };
        } else if (Array.isArray(flair)) {
            return {
                text: this.valueWithPlaceholdersReplaced(flair[0], target, automodMatch),
                cssClass: this.valueWithPlaceholdersReplaced(flair[1], target, automodMatch),
            };
        } else {
            return {
                text: this.valueWithPlaceholdersReplaced(flair.text, target, automodMatch),
                cssClass: this.valueWithPlaceholdersReplaced(flair.css_class, target, automodMatch),
                templateId: flair.template_id,
            };
        }
    }

    private async doTopLevelAction (target: Post | Comment, action: PostOrCommentCondition | CommentAction, automodMatch: AutomodMatch) {
        if (!action.action) {
            return;
        }

        switch (action.action) {
            case "remove": {
                if (!target.approved) {
                    await target.remove();
                    console.log(`Removed target ${target.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
                }
                break;
            }
            case "approve": {
                if (!target.removed) {
                    await target.approve();
                    console.log(`Approved target ${target.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
                }
                break;
            }
            case "report": {
                const reportReason = this.valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, automodMatch);
                await reddit.report(target, { reason: reportReason ?? "Reported by Automod Neo" });
                console.log(`Reported target ${target.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}" with reason "${reportReason ?? "Reported by Automod Neo"}"`);
                break;
            }
            case "spam": {
                if (!target.approved) {
                    await target.remove(true);
                    console.log(`Marked target ${target.id} as spam due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
                }
                break;
            }
            case "filter": {
                const reportReason = this.valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, automodMatch);
                await target.filter({
                    reason: reportReason ?? "Filtered by Automod Neo",
                    keep: false,
                });
                console.log(`Filtered target ${target.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}" with reason "${reportReason ?? "Filtered by Automod Neo"}"`);
                break;
            }
            default: {
                console.warn(`Unknown action: ${action.action}`);
            }
        }
    }

    private async actionRule (target: Post | Comment, matchedRule: AutomodMatch, doMessages = true): Promise<void> {
        console.log(`Applying actions on target ${target.id}`);

        await this.doTopLevelAction(target, matchedRule.rule, matchedRule);

        if (matchedRule.rule.comment) {
            const commentBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.comment, target, matchedRule);
            this.addCommentToAdd(target.id, {
                ruleName: matchedRule.rule.friendly_name ?? "Unnamed rule",
                text: commentBody ?? "",
                shouldLock: matchedRule.rule.comment_locked ?? false,
                shouldSticky: (matchedRule.rule.comment_stickied && isT1(target.id)) ?? false,
            });
        }

        if (matchedRule.rule.author?.set_flair) {
            const user = await this.getUserByUsername(target.authorName);
            const existingUserFlair = user?.getUserFlairBySubreddit(context.subredditName);
            if (matchedRule.rule.author.overwrite_flair || !existingUserFlair) {
                const flairOptions = this.getFlairOptions(matchedRule.rule.author.set_flair, target, matchedRule);
                await reddit.setUserFlair({
                    subredditName: context.subredditName,
                    username: target.authorName,
                    text: flairOptions.text,
                    cssClass: flairOptions.cssClass,
                    flairTemplateId: flairOptions.templateId,
                });
                console.log(`Set flair for user ${target.authorName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}", new flair: ${JSON.stringify(flairOptions)}`);
            }
        }

        if (matchedRule.rule.parent_submission && "postId" in target) {
            const parentSubmissionRules = matchedRule.rule.parent_submission;
            if (parentSubmissionRules.action || parentSubmissionRules.set_flair || parentSubmissionRules.set_sticky || parentSubmissionRules.set_nsfw || parentSubmissionRules.set_spoiler || parentSubmissionRules.set_suggested_sort || parentSubmissionRules.set_post_crowd_control_level) {
                const parentPost = await this.getPostById(target.postId);
                await this.actionRulesForPost(parentPost, matchedRule.rule.parent_submission, matchedRule);
            }
        }

        if (doMessages && matchedRule.rule.message) {
            const messageBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.message, target, matchedRule);
            const messageSubject = this.valueWithPlaceholdersReplaced(matchedRule.rule.message_subject, target, matchedRule) ?? "Automod Neo Notification";
            if (messageBody) {
                await reddit.sendPrivateMessage({
                    to: target.authorName,
                    subject: messageSubject,
                    text: messageBody + "\n\n" + getBotCommentFooter(),
                });
                console.log(`Sent private message to ${target.authorName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (doMessages && matchedRule.rule.modmail) {
            const modmailBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.modmail, target, matchedRule);
            const modmailSubject = this.valueWithPlaceholdersReplaced(matchedRule.rule.modmail_subject, target, matchedRule) ?? "Automod Neo Notification";
            if (modmailBody) {
                await reddit.modMail.createModInboxConversation({
                    subredditId: context.subredditId,
                    subject: modmailSubject,
                    bodyMarkdown: modmailBody + "\n\n" + getBotCommentFooter(),
                });
                console.log(`Sent modmail to subreddit ${context.subredditName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (doMessages && matchedRule.rule.discord_alert) {
            const discordAlertBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.discord_alert, target, matchedRule);
            this.webhookUrl ??= await settings.get<string>(AppSetting.DiscordWebhookUrl);
            if (discordAlertBody) {
                if (this.webhookUrl) {
                    await sendMessageToWebhook(this.webhookUrl, discordAlertBody);
                    console.log(`Sent Discord alert due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
                } else {
                    console.warn("Discord alert specified in rule, but no webhook URL is set in subreddit settings.");
                }
            }
        }

        if (matchedRule.rule.set_locked) {
            await target.lock();
            console.log(`Set lock state for target ${target.id} to ${matchedRule.rule.set_locked} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
        }

        if (!("title" in target)) {
            return;
        }

        // Post only actions from this point.
        await this.actionRulesForPost(target, matchedRule.rule, matchedRule);
    }

    private async actionRulesForPost (post: Post, actions: PostOrCommentCondition, automodMatch: AutomodMatch): Promise<void> {
        await this.doTopLevelAction(post, actions, automodMatch);

        if (actions.set_flair) {
            if (!post.flair || actions.overwrite_flair) {
                const flairOptions = this.getFlairOptions(actions.set_flair, post, automodMatch);
                await reddit.setPostFlair({
                    subredditName: context.subredditName,
                    postId: post.id,
                    text: flairOptions.text,
                    cssClass: flairOptions.cssClass,
                    flairTemplateId: flairOptions.templateId,
                });
                console.log(`Set flair for post ${post.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}", new flair: ${JSON.stringify(flairOptions)}`);
            }
        }

        if (actions.set_sticky !== undefined) {
            if (actions.set_sticky) {
                await post.sticky(typeof actions.set_sticky === "number" ? actions.set_sticky : undefined);
                console.log(`Set sticky for post ${post.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
            } else {
                await post.unsticky();
                console.log(`Unset sticky for post ${post.id} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (actions.set_nsfw !== undefined) {
            if (actions.set_nsfw) {
                await post.markAsNsfw();
                console.log(`Marked post ${post.id} as NSFW due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
            } else {
                await post.unmarkAsNsfw();
                console.log(`Unmarked post ${post.id} as NSFW due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (actions.set_spoiler !== undefined) {
            if (actions.set_spoiler) {
                await post.markAsSpoiler();
                console.log(`Marked post ${post.id} as spoiler due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
            } else {
                await post.unmarkAsSpoiler();
                console.log(`Unmarked post ${post.id} as spoiler due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
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
            console.log(`Set suggested comment sort for post ${post.id} to ${suggestedSort} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
        }

        if (actions.set_post_crowd_control_level) {
            await post.updateCrowdControlLevel(actions.set_post_crowd_control_level);
            console.log(`Set post crowd control level for post ${post.id} to ${actions.set_post_crowd_control_level} due to rule "${automodMatch.rule.friendly_name ?? "Unnamed rule"}"`);
        }
    }

    public async actionRules () {
        const target = await getPostOrCommentById(this.targetId);
        if (isT3(target.id)) {
            this.posts[target.id] = target as Post;
        }

        if (isT3(target.id)) {
            const postTarget = target as Post;
            this.additionalPlaceholders = {
                media_author: postTarget.secureMedia?.oembed?.authorName,
                media_author_url: postTarget.secureMedia?.oembed?.authorUrl,
                media_title: postTarget.secureMedia?.oembed?.title,
            };
        }

        try {
            const targetAuthor = await this.getUserByUsername(target.authorName);
            const targetAuthorFlair = await targetAuthor?.getUserFlairBySubreddit(context.subredditName);
            if (targetAuthorFlair) {
                this.additionalPlaceholders.author_flair_text = targetAuthorFlair.flairText;
                this.additionalPlaceholders.author_flair_css_class = targetAuthorFlair.flairCssClass;
            }
        } catch {
            // Ignore errors when fetching author flair, as it is not critical to the action execution.
            console.error(`Failed to fetch author flair for ${target.authorName}`);
        }

        for (const matchedRule of this.matchedRules) {
            try {
                await this.actionRule(target, matchedRule);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.error(`Error applying actions for rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}" on target ${target.id}:`, message);
            }
        }

        if (Object.keys(this.commentsToAdd).length === 0) {
            return;
        }

        const combineComments = await settings.get<boolean>(AppSetting.CombineComments);

        for (const targetId of Object.keys(this.commentsToAdd) as (T1 | T3)[]) {
            const comments = this.commentsToAdd[targetId];
            if (!comments || comments.length === 0) {
                continue;
            }

            if (combineComments) {
                const shouldLock = comments.some(comment => comment.shouldLock);
                const shouldSticky = comments.some(comment => comment.shouldSticky) && isT3(targetId);

                const combinedCommentText = _.compact(comments.map(comment => comment.text.trim())).join("\n\n---\n\n") + "\n\n" + getBotCommentFooter();

                const newComment = await reddit.submitComment({
                    id: targetId,
                    text: combinedCommentText,
                });

                console.log(`Added combined comment to target ${targetId} due to rules: ${comments.map(comment => comment.ruleName).join(", ")}`);

                if (shouldLock) {
                    await newComment.lock();
                    console.log(`Locked combined comment on target ${targetId}`);
                }

                await newComment.distinguish(shouldSticky);
                console.log(`Distinguished combined comment on target ${targetId}`);
            } else {
                for (const comment of comments) {
                    const newComment = await reddit.submitComment({
                        id: targetId,
                        text: comment.text + "\n\n" + getBotCommentFooter(),
                    });

                    console.log(`Added comment to target ${targetId} due to rule "${comment.ruleName}"`);

                    if (comment.shouldLock) {
                        await newComment.lock();
                        console.log(`Locked comment on target ${targetId} due to rule "${comment.ruleName}"`);
                    }

                    await newComment.distinguish(comment.shouldSticky);
                    console.log(`Distinguished comment on target ${targetId} due to rule "${comment.ruleName}"`);
                }
            }
        }
    }
}
