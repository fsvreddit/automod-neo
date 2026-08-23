import { Comment, context, Post, PostSuggestedCommentSort, reddit, settings, User } from "@devvit/web/server";
import { isT1, isT3, T1, T3 } from "@devvit/web/shared";
import { AutomodMatch, AutomodRule, CommentToAdd, PostOrCommentCondition, SetFlairActionDictionary } from "../types";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getBotCommentFooter, getDomainFromUrl, sendMessageToWebhook } from "../helpers";
import { AppSetting } from "../appSettings";
import markdownEscape from "markdown-escape";
import { hasAutomodActionBeenTaken } from "../automodActions";
import { queueComments } from "..";

interface AdditionalPlaceholders {
    author_flair_text?: string;
    author_flair_css_class?: string;
    media_author?: string;
    media_author_url?: string;
    media_title?: string;
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

    private comments: Record<string, Comment> = {};

    private async getCommentById (commentId: T1): Promise<Comment> {
        this.comments[commentId] ??= await reddit.getCommentById(commentId);
        return this.comments[commentId];
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

    private targetToKindText (target: Post | Comment): string {
        if (isT3(target.id)) {
            return "submission";
        } else {
            return "comment";
        }
    }

    public valueWithPlaceholdersReplaced (input: string | undefined, target: Post | Comment, automodMatch: AutomodMatch): string | undefined {
        if (!input?.includes("{{")) {
            return input;
        }

        const body = target.body ?? "";
        const blockquotedBody = body
            ? body
                    .split("\n")
                    .map(line => `> ${markdownEscape(line)}`)
                    .join("\n")
            : "";

        const parentSubmissionAuthor = "postId" in target ? this.posts[target.postId]?.authorName ?? "" : target.authorName;

        let result = input
            .replace(/(^|\n)>\s*{{body}}(?=\n|$)/g, (_, prefix: string) => `${prefix}${blockquotedBody}`)
            .replaceAll("u/{{author}}", `u/${target.authorName}`)
            .replaceAll("{{author}}", markdownEscape(target.authorName))
            .replaceAll("u/{{parent_submission_author}}", `u/${parentSubmissionAuthor}`)
            .replaceAll("{{parent_submission_author}}", markdownEscape(parentSubmissionAuthor))
            .replaceAll("{{body}}", markdownEscape(body))
            .replaceAll("{{permalink}}", `https://www.reddit.com${target.permalink}`)
            .replaceAll("{{title}}", "title" in target ? markdownEscape(target.title) : this.posts[target.postId]?.title ?? "")
            .replaceAll("r/{{subreddit}}", `r/${target.subredditName}`)
            .replaceAll("{{subreddit}}", markdownEscape(target.subredditName))
            .replaceAll("{{kind}}", this.targetToKindText(target))
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

    private async doPostOrCommentAction (target: Post | Comment, automodMatch: AutomodMatch) {
        const action = automodMatch.rule;

        if (action.comment) {
            const commentBody = this.valueWithPlaceholdersReplaced(action.comment, target, automodMatch);
            this.addCommentToAdd(target.id, {
                ruleName: action.friendly_name ?? "Unnamed rule",
                text: commentBody ?? "",
                shouldLock: action.comment_locked ?? false,
                shouldSticky: (action.comment_stickied && isT3(target.id)) ?? false,
            });
        }

        if (action.set_locked !== undefined) {
            if (action.set_locked) {
                await target.lock();
            } else {
                await target.unlock();
            }
            console.log(`Set lock state for target ${target.id} to ${action.set_locked} due to rule "${action.friendly_name ?? "Unnamed rule"}"`);
        }

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
                const reportReason = this.valueWithPlaceholdersReplaced(action.report_reason ?? action.action_reason, target, automodMatch)?.substring(0, 99);
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
        console.log(`Applying actions on ${isT3(target.id) ? "post" : "comment"} ${target.id}`);

        await this.doPostOrCommentAction(target, matchedRule);

        if (matchedRule.rule.author?.set_flair) {
            const user = await this.getUserByUsername(target.authorName);
            const existingUserFlair = await user?.getUserFlairBySubreddit(context.subredditName);
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
            const parentPost = await this.getPostById(target.postId);

            const matchItem = {
                rule: {
                    ...matchedRule.rule.parent_submission,
                    friendly_name: matchedRule.rule.friendly_name,
                },
                matches: matchedRule.matches,
            } satisfies AutomodMatch;

            await this.doPostOrCommentAction(parentPost, matchItem);
            await this.actionRulesForPost(parentPost, matchedRule.rule.parent_submission, matchedRule);
        }

        if (matchedRule.rule.parent_comment && "parentId" in target && isT1(target.parentId)) {
            const parentComment = await this.getCommentById(target.parentId);

            const matchItem = {
                rule: {
                    ...matchedRule.rule.parent_comment,
                    friendly_name: matchedRule.rule.friendly_name,
                },
                matches: matchedRule.matches,
            } satisfies AutomodMatch;

            await this.doPostOrCommentAction(parentComment, matchItem);
        }

        if (doMessages && matchedRule.rule.message) {
            const messageBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.message, target, matchedRule);
            const messageSubject = this.valueWithPlaceholdersReplaced(matchedRule.rule.message_subject, target, matchedRule)
                ?? `A message about your ${this.targetToKindText(target)} on r/${target.subredditName}`;
            if (messageBody) {
                const messageText = target.permalink + "\n\n" + messageBody + "\n\n" + getBotCommentFooter(target);
                try {
                    await reddit.sendPrivateMessage({
                        to: target.authorName,
                        subject: messageSubject,
                        text: messageText + "\n\n" + "*This is an unmonitored inbox, please do not reply to this message.*",
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`Failed to send private message to ${target.authorName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}":`, message);

                    // Fall back to modmail for users with chats disabled.
                    const modmail = await reddit.modMail.createConversation({
                        subredditName: context.subredditName,
                        subject: messageSubject,
                        body: messageText,
                        to: target.authorName,
                        isAuthorHidden: true,
                    });

                    if (modmail.conversation.id) {
                        await reddit.modMail.archiveConversation(modmail.conversation.id);
                    }
                }
                console.log(`Sent private message to ${target.authorName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (doMessages && matchedRule.rule.modmail) {
            const modmailBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.modmail, target, matchedRule);
            const modmailSubject = this.valueWithPlaceholdersReplaced(matchedRule.rule.modmail_subject, target, matchedRule)
                ?? `Notification about a ${this.targetToKindText(target)} for u/${target.authorName}`;

            if (modmailBody) {
                await reddit.modMail.createModInboxConversation({
                    subredditId: context.subredditId,
                    subject: modmailSubject,
                    bodyMarkdown: target.permalink + "\n\n" + modmailBody,
                });
                console.log(`Sent modmail to subreddit ${context.subredditName} due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
            }
        }

        if (doMessages && matchedRule.rule.discord_alert) {
            const discordAlertBody = this.valueWithPlaceholdersReplaced(matchedRule.rule.discord_alert, target, matchedRule);
            this.webhookUrl ??= await settings.get<string>(AppSetting.DiscordOrSlackWebhookUrl);
            if (discordAlertBody) {
                if (this.webhookUrl) {
                    await sendMessageToWebhook(this.webhookUrl, discordAlertBody);
                    console.log(`Sent Discord alert due to rule "${matchedRule.rule.friendly_name ?? "Unnamed rule"}"`);
                } else {
                    console.warn("Discord alert specified in rule, but no webhook URL is set in subreddit settings.");
                }
            }
        }

        if (!("title" in target)) {
            return;
        }

        // Post only actions from this point.
        await this.actionRulesForPost(target, matchedRule.rule, matchedRule);
    }

    private async actionRulesForPost (post: Post, actions: PostOrCommentCondition, automodMatch: AutomodMatch): Promise<void> {
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

    private anyPlaceholdersFound (ruleMatch: AutomodMatch, placeholdersToFind: string[]): boolean {
        const locationsToCheck = [
            "action_reason",
            "report_reason",
            "comment",
            "message",
            "message_subject",
            "modmail",
            "modmail_subject",
            "discord_alert",
        ];

        const { rule } = ruleMatch;

        for (const location of locationsToCheck) {
            const value = rule[location as keyof AutomodRule];
            if (typeof value === "string" && placeholdersToFind.some(placeholder => value.includes(`{{${placeholder}}}`))) {
                return true;
            }
        }

        return false;
    }

    public async actionRules () {
        const skipRulesThatAutomodHasActedOn = await settings.get<boolean>(AppSetting.SkipRulesThatAutomodHasActedOn);
        if (skipRulesThatAutomodHasActedOn && await hasAutomodActionBeenTaken(this.targetId)) {
            console.log(`Skipping action rules for target ${this.targetId} because Automod has already acted on it.`);
            return;
        }

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

        if (this.matchedRules.some(ruleMatch => this.anyPlaceholdersFound(ruleMatch, ["author_flair_text", "author_flair_css_class"]))) {
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
        }

        if ("postId" in target && this.matchedRules.some(ruleMatch => this.anyPlaceholdersFound(ruleMatch, ["title", "parent_submission_author"]))) {
            await this.getPostById(target.postId);
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

        await queueComments(this.commentsToAdd);
    }
}
