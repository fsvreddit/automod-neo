/* eslint-disable camelcase */
import { Comment, context, Post, reddit, User, UserFlair, UserSocialLink } from "@devvit/web/server";
import { isT3, T1, T3 } from "@devvit/web/shared";
import { Author, AutomodMatch, AutomodRule, Matches, PostOrCommentCondition, SearchableText } from "../types";
import { getDomainFromUrl, isApprovedUser, isModerator, isSubredditNSFW } from "../helpers";
import { meetsDateThreshold, meetsNumericThreshold } from "./thresholdChecks";
import { subMonths } from "date-fns";
import { anySearchConditionMatchesInput, postMatchesStandardCondition, searchConditionsMatchInput, sortRulesForExecution } from ".";

export class AutomodRuleChecker {
    private rules: AutomodRule[];

    private posts: Record<string, Post> = {};
    private comments: Record<string, Comment> = {};
    private users: Record<string, User> = {};
    private userFlair: Record<string, UserFlair | undefined> = {};
    private userSocialLinks: Record<string, UserSocialLink[]> = {};
    private userIsApprovedUser: Record<string, boolean> = {};
    private userIsModerator: Record<string, boolean> = {};
    private userSubredditKarma: Record<string, { fromComments: number; fromPosts: number }> = {};

    constructor (opts: {
        rules: AutomodRule[];
        post?: Post;
        comment?: Comment;
    }) {
        this.rules = sortRulesForExecution(opts.rules);

        if (opts.post) {
            this.posts[opts.post.id] = opts.post;
        }

        if (opts.comment) {
            this.comments[opts.comment.id] = opts.comment;
        }
    }

    private async getUserByUsername (username: string): Promise<User | undefined> {
        if (!this.users[username]) {
            const user = await reddit.getUserByUsername(username);
            if (user) {
                this.users[username] = user;
            }
        }

        return this.users[username];
    }

    private async getUserFlair (user: User): Promise<UserFlair | undefined> {
        if (!(user.username in this.userFlair)) {
            const flair = await user.getUserFlairBySubreddit(context.subredditName);
            this.userFlair[user.username] = flair;
        }
        return this.userFlair[user.username];
    }

    private async getUserSocialLinks (username: string): Promise<UserSocialLink[]> {
        if (!this.userSocialLinks[username]) {
            const user = await this.getUserByUsername(username);
            if (user) {
                this.userSocialLinks[username] = await user.getSocialLinks();
            }
        }

        return this.userSocialLinks[username] ?? [];
    }

    private async getIsUserApprovedUser (user: User): Promise<boolean> {
        let isSubmitter = this.userIsApprovedUser[user.username];
        if (isSubmitter !== undefined) {
            return isSubmitter;
        }

        isSubmitter = await isApprovedUser(user);
        this.userIsApprovedUser[user.username] = isSubmitter;
        return isSubmitter;
    }

    private async getIsUserModerator (user: User): Promise<boolean> {
        let isMod = this.userIsModerator[user.username];
        if (isMod !== undefined) {
            return isMod;
        }

        isMod = await isModerator(user);
        this.userIsModerator[user.username] = isMod;
        return isMod;
    }

    private async getUserSubredditKarma (user: User): Promise<{ fromComments: number; fromPosts: number }> {
        let karma = this.userSubredditKarma[user.username];
        if (karma !== undefined) {
            return karma;
        }

        const subredditKarma = await reddit.getUserKarmaFromCurrentSubreddit(user.username);
        karma = {
            fromComments: subredditKarma.fromComments ?? 0,
            fromPosts: subredditKarma.fromPosts ?? 0,
        };

        this.userSubredditKarma[user.username] = karma;
        return karma;
    }

    private async getPostById (postId: T3): Promise<Post> {
        if (!this.posts[postId]) {
            const post = await reddit.getPostById(postId);
            this.posts[postId] = post;
        }

        return this.posts[postId];
    }

    private async getCommentById (commentId: T1): Promise<Comment> {
        if (!this.comments[commentId]) {
            const comment = await reddit.getCommentById(commentId);
            this.comments[commentId] = comment;
        }

        return this.comments[commentId];
    }

    private getTextWithoutBlockquotes (text: string): string {
        const textLines: string[] = text.split("\n");
        const textWithoutBlockquotes: string[] = [];
        for (const line of textLines) {
            if (!line.trim().startsWith(">")) {
                textWithoutBlockquotes.push(line);
            }
        }
        return textWithoutBlockquotes.join("\n");
    }

    private getDistinctSearchFields (textSearchConditions: SearchableText[]): Set<string> {
        const conditions = new Set<string>();
        for (const condition of textSearchConditions) {
            for (const field of condition.searchField) {
                conditions.add(field);
            }
        }
        return conditions;
    }

    private async authorMatchesCondition (username: string, authorCondition: Author): Promise<Matches[] | undefined> {
        const user = await this.getUserByUsername(username);
        if (!user) {
            return;
        }

        // Simple checks for author conditions
        if (authorCondition.has_verified_email !== undefined) {
            if (user.hasVerifiedEmail !== authorCondition.has_verified_email) {
                return;
            }
        }

        if (authorCondition.is_gold !== undefined) {
            if (user.hasRedditPremium !== authorCondition.is_gold) {
                return;
            }
        }

        if (authorCondition.is_contributor !== undefined) {
            if (await this.getIsUserApprovedUser(user) !== authorCondition.is_contributor) {
                return;
            }
        }

        if (authorCondition.is_moderator !== undefined) {
            if (await this.getIsUserModerator(user) !== authorCondition.is_moderator) {
                return;
            }
        }

        let anyThresholdMatched: boolean | undefined = undefined;

        if (authorCondition.comment_karma !== undefined) {
            if (!meetsNumericThreshold(user.commentKarma, authorCondition.comment_karma)) {
                if (!authorCondition.satisfy_any_threshold) {
                    return;
                } else {
                    anyThresholdMatched ??= false;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        if (authorCondition.post_karma !== undefined) {
            if (!meetsNumericThreshold(user.linkKarma, authorCondition.post_karma)) {
                if (!authorCondition.satisfy_any_threshold) {
                    return;
                } else {
                    anyThresholdMatched ??= false;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        if (authorCondition.combined_karma !== undefined) {
            const combinedKarma = user.commentKarma + user.linkKarma;
            if (!meetsNumericThreshold(combinedKarma, authorCondition.combined_karma)) {
                if (!authorCondition.satisfy_any_threshold) {
                    return;
                } else {
                    anyThresholdMatched ??= false;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        if (authorCondition.account_age !== undefined) {
            if (!meetsDateThreshold(user.createdAt, authorCondition.account_age)) {
                if (!authorCondition.satisfy_any_threshold) {
                    return;
                } else {
                    anyThresholdMatched ??= false;
                }
            } else {
                anyThresholdMatched = true;
            }
        }

        // More expensive checks that need async calls. Run last to allow for early exit
        if (authorCondition.combined_subreddit_karma !== undefined || authorCondition.comment_subreddit_karma !== undefined || authorCondition.post_subreddit_karma !== undefined) {
            const subredditKarma = await this.getUserSubredditKarma(user);

            if (authorCondition.comment_subreddit_karma !== undefined) {
                if (!meetsNumericThreshold(subredditKarma.fromComments, authorCondition.comment_subreddit_karma)) {
                    if (!authorCondition.satisfy_any_threshold) {
                        return;
                    } else {
                        anyThresholdMatched ??= false;
                    }
                } else {
                    anyThresholdMatched = true;
                }
            }

            if (authorCondition.post_subreddit_karma !== undefined) {
                if (!meetsNumericThreshold(subredditKarma.fromPosts, authorCondition.post_subreddit_karma)) {
                    if (!authorCondition.satisfy_any_threshold) {
                        return;
                    } else {
                        anyThresholdMatched ??= false;
                    }
                } else {
                    anyThresholdMatched = true;
                }
            }

            if (authorCondition.combined_subreddit_karma !== undefined) {
                const combinedSubredditKarma = subredditKarma.fromComments + subredditKarma.fromPosts;
                if (!meetsNumericThreshold(combinedSubredditKarma, authorCondition.combined_subreddit_karma)) {
                    if (!authorCondition.satisfy_any_threshold) {
                        return;
                    } else {
                        anyThresholdMatched ??= false;
                    }
                } else {
                    anyThresholdMatched = true;
                }
            }
        }

        if (authorCondition.satisfy_any_threshold && anyThresholdMatched === false) {
            return;
        }

        // Search conditions
        const searchFields: Record<string, string | string[]> = {
            id: user.id,
            name: user.username,
            display_name: user.displayName,
            bio_text: user.about,
        };

        const distinctSearchFields = this.getDistinctSearchFields(authorCondition.search_conditions ?? []);
        if (distinctSearchFields.has("social_links")) {
            const socialLinks = await this.getUserSocialLinks(user.username);
            searchFields.social_links = socialLinks.map(link => link.outboundUrl);
        }

        if (distinctSearchFields.has("flair_text") || distinctSearchFields.has("flair_css_class") || distinctSearchFields.has("flair_template_id")) {
            const userFlair = await this.getUserFlair(user);
            if (userFlair?.flairText) {
                searchFields.flair_text = userFlair.flairText;
            }
            if (userFlair?.flairCssClass) {
                searchFields.flair_css_class = userFlair.flairCssClass;
            }
        }

        return searchConditionsMatchInput(searchFields, authorCondition.search_conditions ?? []);
    }

    public async checkPostAgainstCondition (postId: T3, rule: PostOrCommentCondition): Promise<Matches[] | undefined> {
        const post = await this.getPostById(postId);

        if (rule.standard !== undefined) {
            if (!postMatchesStandardCondition(post, rule.standard)) {
                return;
            }
        }

        if (rule.is_edited !== undefined) {
            if (post.edited !== rule.is_edited) {
                return;
            }
        }

        if (rule.is_gallery !== undefined) {
            if ((post.gallery.length > 0) !== rule.is_gallery) {
                return;
            }
        }

        if (rule.past_archive_date !== undefined) {
            const isPastArchiveDate = post.createdAt < subMonths(new Date(), 6);
            if (isPastArchiveDate !== rule.past_archive_date) {
                return;
            }
        }

        if (rule.subreddit?.search_conditions && rule.subreddit.search_conditions.length > 0) {
            const subredditMatches = anySearchConditionMatchesInput(post.subredditName, rule.subreddit.search_conditions);
            if (!subredditMatches) {
                return;
            }
        }

        if (rule.subreddit?.is_nsfw !== undefined) {
            const isSubredditNSFWResult = await isSubredditNSFW(post.subredditName);
            if (isSubredditNSFWResult !== rule.subreddit.is_nsfw) {
                return;
            }
        }

        if (rule.is_poll !== undefined) {
            if ((post.pollData !== undefined) !== rule.is_poll) {
                return;
            }
        }

        if (rule.reports !== undefined) {
            if (post.numberOfReports < rule.reports) {
                return;
            }
        }

        const matches: Matches[] = [];
        const postBody = post.body && rule.ignore_blockquotes ? this.getTextWithoutBlockquotes(post.body) : post.body;

        const searchFields: Record<string, string | string[]> = {
            id: post.id,
            title: post.title,
            url: post.url,
        };
        const distinctSearchFields = this.getDistinctSearchFields(rule.search_conditions ?? []);

        if (postBody) {
            searchFields.body = postBody;
        }

        const domain = getDomainFromUrl(post.url);
        if (domain) {
            searchFields.domain = domain;
        }

        if (post.flair?.text) {
            searchFields.flair_text = post.flair.text;
        }

        if (post.flair?.cssClass) {
            searchFields.flair_css_class = post.flair.cssClass;
        }

        if (post.flair?.templateId) {
            searchFields.flair_template_id = post.flair.templateId;
        }

        if (post.crosspostParentId && distinctSearchFields.has("crosspost_title")) {
            const crossPost = await this.getPostById(post.crosspostParentId);
            searchFields.crosspost_title = crossPost.title;
        }

        if (distinctSearchFields.has("media_author") && post.secureMedia?.oembed?.authorName) {
            searchFields.media_author = post.secureMedia.oembed.authorName;
        }

        if (distinctSearchFields.has("media_author_url") && post.secureMedia?.oembed?.authorUrl) {
            searchFields.media_author_url = post.secureMedia.oembed.authorUrl;
        }

        if (distinctSearchFields.has("media_title") && post.secureMedia?.oembed?.title) {
            searchFields.media_title = post.secureMedia.oembed.title;
        }

        if (distinctSearchFields.has("media_description") && post.secureMedia?.oembed?.html) {
            searchFields.media_description = post.secureMedia.oembed.html;
        }

        const searchMatches = searchConditionsMatchInput(searchFields, rule.search_conditions ?? []);
        if (!searchMatches) {
            return;
        }
        matches.push(...searchMatches);

        // Crosspost checks
        if (rule.crosspost_id !== undefined) {
            if (!rule.crosspost_id.some(id => post.crosspostParentId === `t3_${id}`)) {
                return;
            }
        }

        if (rule.crosspost_author !== undefined) {
            if (!post.crosspostParentId) {
                return;
            }

            const crossPost = await this.getPostById(post.crosspostParentId);
            const crosspostAuthorMatches = await this.authorMatchesCondition(crossPost.authorName, rule.crosspost_author);
            if (!crosspostAuthorMatches) {
                return;
            }
        }

        if ((rule.crosspost_subreddit?.search_conditions && rule.crosspost_subreddit.search_conditions.length > 0) || rule.crosspost_subreddit?.is_nsfw !== undefined) {
            if (!post.crosspostParentId) {
                return;
            }
            const crossPost = await this.getPostById(post.crosspostParentId);

            if (rule.crosspost_subreddit.search_conditions !== undefined) {
                const crosspostSubredditMatches = anySearchConditionMatchesInput(crossPost.subredditName, rule.crosspost_subreddit.search_conditions);
                if (!crosspostSubredditMatches) {
                    return;
                }
            }

            if (rule.crosspost_subreddit.is_nsfw !== undefined) {
                const isCrosspostSubredditNSFW = await isSubredditNSFW(crossPost.subredditName);
                if (isCrosspostSubredditNSFW !== rule.crosspost_subreddit.is_nsfw) {
                    return;
                }
            }
        }

        if (rule.author) {
            const authorMatches = await this.authorMatchesCondition(post.authorName, rule.author);
            if (!authorMatches) {
                return;
            }
            matches.push(...authorMatches);
        }

        return matches;
    }

    public async checkComment (commentId: T1): Promise<AutomodMatch | undefined> {
        if (this.rules.length === 0) {
            return;
        }

        const comment = await this.getCommentById(commentId);

        for (const rule of this.rules) {
            const matches: Matches[] = [];

            if (rule.type !== "any" && rule.type !== "comment") {
                continue;
            }

            const commentBody = rule.ignore_blockquotes ? this.getTextWithoutBlockquotes(comment.body) : comment.body;

            if (rule.reports !== undefined) {
                if (comment.numReports < rule.reports) {
                    continue;
                }
            }

            if (rule.body_shorter_than !== undefined) {
                if (commentBody.length >= rule.body_shorter_than) {
                    continue;
                }
            }

            if (rule.body_longer_than !== undefined) {
                if (commentBody.length <= rule.body_longer_than) {
                    continue;
                }
            }

            if (rule.is_edited !== undefined) {
                if (comment.edited !== rule.is_edited) {
                    continue;
                }
            }

            if (rule.is_top_level !== undefined) {
                const isTopLevel = isT3(comment.parentId);
                if (isTopLevel !== rule.is_top_level) {
                    continue;
                }
            }

            if (rule.past_archive_date !== undefined) {
                const isPastArchiveDate = comment.createdAt < subMonths(new Date(), 6);
                if (isPastArchiveDate !== rule.past_archive_date) {
                    continue;
                }
            }

            if (rule.comment_crowd_control_collapsed !== undefined) {
                if (comment.collapsedBecauseCrowdControl !== rule.comment_crowd_control_collapsed) {
                    continue;
                }
            }

            // Search conditions
            const searchFields: Record<string, string | string[]> = {
                id: comment.id,
                body: commentBody,
            };

            const searchMatches = searchConditionsMatchInput(searchFields, rule.search_conditions ?? []);
            if (!searchMatches) {
                continue;
            }
            matches.push(...searchMatches);

            // Parent submissions
            if (rule.parent_submission !== undefined) {
                if (!await this.checkPostAgainstCondition(comment.postId, rule.parent_submission)) {
                    continue;
                }
            }

            if (rule.author) {
                const authorMatches = await this.authorMatchesCondition(comment.authorName, rule.author);
                if (!authorMatches) {
                    continue;
                }

                if (rule.author.is_submitter !== undefined) {
                    const parentSubmission = await this.getPostById(comment.postId);
                    if (rule.author.is_submitter !== (parentSubmission.authorName === comment.authorName)) {
                        continue;
                    }
                }
            }

            return { rule, matches };
        }
    }

    public async checkPost (postId: T3): Promise<AutomodMatch | undefined> {
        if (this.rules.length === 0) {
            return;
        }

        for (const rule of this.rules) {
            if (rule.type === "comment") {
                continue;
            }

            const matches = await this.checkPostAgainstCondition(postId, rule);
            if (!matches) {
                continue;
            }

            return { rule, matches };
        }
    }
}
