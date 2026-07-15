/* eslint-disable camelcase */
import { Comment, context, Post, reddit, User, UserFlair, UserSocialLink } from "@devvit/web/server";
import { CommentV2, isT3, T1, T3 } from "@devvit/web/shared";
import { Author, AutomodMatch, AutomodRule, Matches, PostOrCommentCondition, SearchableText } from "../types";
import { getDomainFromUrl, isApprovedUser, isModerator, isRemovalRule, isSubredditNSFW } from "../helpers";
import { meetsDateThreshold, meetsNumericThreshold } from "./thresholdChecks";
import { subMonths } from "date-fns";
import { anySearchConditionMatchesInput, postMatchesStandardCondition, searchConditionsMatchInput } from ".";

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

    private verboseLogs = false;

    constructor (opts: {
        rules: AutomodRule[];
        post?: Post;
        comment?: Comment;
    }) {
        this.rules = opts.rules;

        if (opts.post) {
            this.posts[opts.post.id] = opts.post;
        }

        if (opts.comment) {
            this.comments[opts.comment.id] = opts.comment;
        }
    }

    private async getUserByUsername (username: string): Promise<User | undefined> {
        if (!this.users[username]) {
            let user: User | undefined;
            try {
                user = await reddit.getUserByUsername(username);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.error(`Error fetching user by username ${username}: ${message}`);
            }

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

    private async getIsUserApprovedUser (username: string): Promise<boolean> {
        let isSubmitter = this.userIsApprovedUser[username];
        if (isSubmitter !== undefined) {
            return isSubmitter;
        }

        isSubmitter = await isApprovedUser(username);
        this.userIsApprovedUser[username] = isSubmitter;
        return isSubmitter;
    }

    private async getIsUserModerator (username: string): Promise<boolean> {
        let isMod = this.userIsModerator[username];
        if (isMod !== undefined) {
            return isMod;
        }

        isMod = await isModerator(username);
        this.userIsModerator[username] = isMod;
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

    private log (message: string, checkContext?: string): void {
        if (this.verboseLogs) {
            if (checkContext) {
                console.log(`Verbose Logs [${checkContext}]: ${message}`);
            } else {
                console.log(`Verbose Logs: ${message}`);
            }
        }
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

    private shouldStop (rule: AutomodRule): boolean {
        if (rule.stop_on_match !== undefined) {
            return rule.stop_on_match;
        }

        return isRemovalRule(rule);
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

    private async authorMatchesCondition (username: string, authorCondition: Author, checkContext?: string): Promise<Matches[] | undefined> {
        if (authorCondition.is_contributor !== undefined) {
            if (await this.getIsUserApprovedUser(username) !== authorCondition.is_contributor) {
                this.log(`${username} does not match is_contributor condition (${authorCondition.is_contributor}).`, checkContext);
                return;
            }
        }

        if (authorCondition.is_moderator !== undefined) {
            if (await this.getIsUserModerator(username) !== authorCondition.is_moderator) {
                this.log(`${username} does not match is_moderator condition (${authorCondition.is_moderator}).`, checkContext);
                return;
            }
        }

        const user = await this.getUserByUsername(username);
        if (!user) {
            this.log(`${username} not found for author condition check.`, checkContext);
            return;
        }

        // Simple checks for author conditions
        if (authorCondition.is_nsfw !== undefined) {
            if (user.nsfw !== authorCondition.is_nsfw) {
                this.log(`${username} does not match is_nsfw condition (${authorCondition.is_nsfw}).`, checkContext);
                return;
            }
        }

        if (authorCondition.has_verified_email !== undefined) {
            if (user.hasVerifiedEmail !== authorCondition.has_verified_email) {
                this.log(`${username} does not match has_verified_email condition (${authorCondition.has_verified_email}).`, checkContext);
                return;
            }
        }

        if (authorCondition.is_gold !== undefined) {
            if (user.hasRedditPremium !== authorCondition.is_gold) {
                this.log(`${username} does not match is_gold condition (${authorCondition.is_gold}).`, checkContext);
                return;
            }
        }

        let anyThresholdMatched: boolean | undefined = undefined;

        if (authorCondition.comment_karma !== undefined) {
            if (!meetsNumericThreshold(user.commentKarma, authorCondition.comment_karma)) {
                this.log(`${username} does not match comment_karma condition (${authorCondition.comment_karma}).`, checkContext);
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
                this.log(`${username} does not match post_karma condition (${authorCondition.post_karma}).`, checkContext);
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
                this.log(`${username} does not match combined_karma condition (${authorCondition.combined_karma}).`, checkContext);
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
                this.log(`${username} does not match account_age condition (${authorCondition.account_age}).`, checkContext);
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
                    this.log(`${username} does not match comment_subreddit_karma condition (${authorCondition.comment_subreddit_karma}).`, checkContext);
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
                    this.log(`${username} does not match post_subreddit_karma condition (${authorCondition.post_subreddit_karma}).`, checkContext);
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
                    this.log(`${username} does not match combined_subreddit_karma condition (${authorCondition.combined_subreddit_karma}).`, checkContext);
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
            this.log(`${username} does not match any threshold conditions.`, checkContext);
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

        const matched = searchConditionsMatchInput(searchFields, authorCondition.search_conditions ?? []);
        if (!matched) {
            this.log(`${username} does not match author search conditions.`, checkContext);
        }

        return matched;
    }

    public async checkPostAgainstCondition (post: Post, rule: PostOrCommentCondition, checkContext?: string): Promise<Matches[] | undefined> {
        if (rule.standard !== undefined) {
            if (!postMatchesStandardCondition(post, rule.standard)) {
                this.log(`Post ${post.id} does not match standard condition (${rule.standard}).`, checkContext);
                return;
            }
        }

        if (rule.is_nsfw !== undefined) {
            if (post.nsfw !== rule.is_nsfw) {
                this.log(`Post ${post.id} does not match is_nsfw condition (${rule.is_nsfw}).`, checkContext);
                return;
            }
        }

        if (rule.is_edited !== undefined) {
            if (post.edited !== rule.is_edited) {
                this.log(`Post ${post.id} does not match is_edited condition (${rule.is_edited}).`, checkContext);
                return;
            }
        }

        if (rule.is_gallery !== undefined) {
            if ((post.gallery.length > 0) !== rule.is_gallery) {
                this.log(`Post ${post.id} does not match is_gallery condition (${rule.is_gallery}).`, checkContext);
                return;
            }
        }

        if (rule.past_archive_date !== undefined) {
            const isPastArchiveDate = post.createdAt < subMonths(new Date(), 6);
            if (isPastArchiveDate !== rule.past_archive_date) {
                this.log(`Post ${post.id} does not match past_archive_date condition (${rule.past_archive_date}).`, checkContext);
                return;
            }
        }

        const isCrossPost = post.crosspostParentId !== undefined;
        let postBody: string | undefined;
        if (isCrossPost) {
            const crosspostParent = await this.getPostById(post.crosspostParentId);
            postBody = crosspostParent.body && rule.ignore_blockquotes ? this.getTextWithoutBlockquotes(crosspostParent.body) : crosspostParent.body;
        } else {
            postBody = post.body && rule.ignore_blockquotes ? this.getTextWithoutBlockquotes(post.body) : post.body;
        }

        if (rule.subreddit?.search_conditions && rule.subreddit.search_conditions.length > 0) {
            const subredditMatches = anySearchConditionMatchesInput(post.subredditName, rule.subreddit.search_conditions);
            if (!subredditMatches) {
                this.log(`Post ${post.id} does not match subreddit search conditions.`, checkContext);
                return;
            }
        }

        if (rule.subreddit?.is_nsfw !== undefined) {
            const isSubredditNSFWResult = await isSubredditNSFW(post.subredditName);
            if (isSubredditNSFWResult !== rule.subreddit.is_nsfw) {
                this.log(`Post ${post.id} does not match subreddit is_nsfw condition (${rule.subreddit.is_nsfw}).`, checkContext);
                return;
            }
        }

        if (rule.is_poll !== undefined) {
            if ((post.pollData !== undefined) !== rule.is_poll) {
                this.log(`Post ${post.id} does not match is_poll condition (${rule.is_poll}).`, checkContext);
                return;
            }
        }

        if (rule.reports !== undefined) {
            if (post.numberOfReports < rule.reports) {
                this.log(`Post ${post.id} does not match reports condition (${rule.reports}).`, checkContext);
                return;
            }
        }

        if (rule.poll_option_count !== undefined) {
            if (!post.pollData) {
                this.log(`Post ${post.id} does not have poll data, but poll_option_count condition is specified.`, checkContext);
                return;
            }
            const pollOptionCount = post.pollData.options.length;
            const meetsThreshold = meetsNumericThreshold(pollOptionCount, rule.poll_option_count);
            if (!meetsThreshold) {
                this.log(`Post ${post.id} does not match poll_option_count condition (${rule.poll_option_count}).`, checkContext);
                return;
            }
        }

        if (rule.age !== undefined) {
            const meetsThreshold = meetsDateThreshold(post.createdAt, rule.age);
            if (!meetsThreshold) {
                this.log(`Post ${post.id} does not match age condition (${rule.age}).`, checkContext);
                return;
            }
        }

        const matches: Matches[] = [];

        const searchFields: Record<string, string | string[]> = {
            id: post.id,
            title: post.title,
        };

        const distinctSearchFields = this.getDistinctSearchFields(rule.search_conditions ?? []);

        if (postBody) {
            searchFields.body = postBody;
        }

        if (post.pollData && distinctSearchFields.has("poll_option_text")) {
            searchFields.poll_option_text = post.pollData.options.map(option => option.text);
        }

        if (isCrossPost && (distinctSearchFields.has("domain") || distinctSearchFields.has("url"))) {
            const crosspostParent = await this.getPostById(post.crosspostParentId);
            const crossPostIsSelfPost = crosspostParent.url.includes(crosspostParent.permalink);
            if (crossPostIsSelfPost) {
                searchFields.domain = `self.${crosspostParent.subredditName}`;
            } else {
                const domain = getDomainFromUrl(crosspostParent.url);
                if (domain) {
                    searchFields.domain = domain;
                }
            }
            searchFields.url = crosspostParent.url;
        } else {
            const isSelfPost = post.url.includes(post.permalink);
            if (isSelfPost) {
                searchFields.domain = `self.${post.subredditName}`;
            } else {
                const domain = getDomainFromUrl(post.url);
                if (domain) {
                    searchFields.domain = domain;
                }
            }
            searchFields.url = post.url;
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

        const searchMatches = searchConditionsMatchInput(searchFields, rule.search_conditions ?? []);
        if (!searchMatches) {
            this.log(`Post ${post.id} does not match search conditions.`, checkContext);
            return;
        }
        matches.push(...searchMatches);

        // Crosspost checks
        if (rule.crosspost_id !== undefined) {
            if (!rule.crosspost_id.some(id => post.crosspostParentId === `t3_${id}`)) {
                this.log(`Post ${post.id} does not match crosspost_id condition (${rule.crosspost_id}).`, checkContext);
                return;
            }
        }

        if (rule.crosspost_author !== undefined) {
            if (!post.crosspostParentId) {
                this.log(`Post ${post.id} does not have a crosspost parent, but crosspost_author condition is specified.`, checkContext);
                return;
            }

            const crossPost = await this.getPostById(post.crosspostParentId);
            const crosspostAuthorMatches = await this.authorMatchesCondition(crossPost.authorName, rule.crosspost_author);
            if (!crosspostAuthorMatches) {
                this.log(`Post ${post.id} does not match crosspost_author condition.`, checkContext);
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
                    this.log(`Post ${post.id} does not match crosspost_subreddit search conditions.`, checkContext);
                    return;
                }
            }

            if (rule.crosspost_subreddit.is_nsfw !== undefined) {
                const isCrosspostSubredditNSFW = await isSubredditNSFW(crossPost.subredditName);
                if (isCrosspostSubredditNSFW !== rule.crosspost_subreddit.is_nsfw) {
                    this.log(`Post ${post.id} does not match crosspost_subreddit is_nsfw condition (${rule.crosspost_subreddit.is_nsfw}).`, checkContext);
                    return;
                }
            }
        }

        if (rule.author) {
            const authorMatches = await this.authorMatchesCondition(post.authorName, rule.author);
            if (!authorMatches) {
                this.log(`Post ${post.id} does not match author condition.`, checkContext);
                return;
            }
            matches.push(...authorMatches);
        }

        return matches;
    }

    public async checkComment (comment: CommentV2, authorName: string): Promise<AutomodMatch[]> {
        if (this.rules.length === 0) {
            return [];
        }

        const results: AutomodMatch[] = [];

        for (const rule of this.rules) {
            const matches: Matches[] = [];

            if (rule.type !== undefined && rule.type !== "any" && rule.type !== "comment") {
                continue;
            }

            this.verboseLogs = rule.verbose_logs ?? false;

            const commentBody = rule.ignore_blockquotes ? this.getTextWithoutBlockquotes(comment.body) : comment.body;

            if (rule.reports !== undefined) {
                if (comment.numReports < rule.reports) {
                    this.log(`Comment ${comment.id} does not match reports condition (${rule.reports}).`);
                    continue;
                }
            }

            if (rule.body_shorter_than !== undefined) {
                if (commentBody.length >= rule.body_shorter_than) {
                    this.log(`Comment ${comment.id} does not match body_shorter_than condition (${rule.body_shorter_than}).`);
                    continue;
                }
            }

            if (rule.body_longer_than !== undefined) {
                if (commentBody.length <= rule.body_longer_than) {
                    this.log(`Comment ${comment.id} does not match body_longer_than condition (${rule.body_longer_than}).`);
                    continue;
                }
            }

            if (rule.is_top_level !== undefined) {
                const isTopLevel = isT3(comment.parentId);
                if (isTopLevel !== rule.is_top_level) {
                    this.log(`Comment ${comment.id} does not match is_top_level condition (${rule.is_top_level}).`);
                    continue;
                }
            }

            if (rule.past_archive_date !== undefined) {
                const parentSubmission = await this.getPostById(comment.postId as T3);
                const isPastArchiveDate = parentSubmission.createdAt < subMonths(new Date(), 6);
                if (isPastArchiveDate !== rule.past_archive_date) {
                    this.log(`Comment ${comment.id} does not match past_archive_date condition (${rule.past_archive_date}).`);
                    continue;
                }
            }

            if (rule.comment_crowd_control_collapsed !== undefined) {
                if (comment.collapsedBecauseCrowdControl !== rule.comment_crowd_control_collapsed) {
                    this.log(`Comment ${comment.id} does not match comment_crowd_control_collapsed condition (${rule.comment_crowd_control_collapsed}).`);
                    continue;
                }
            }

            if (rule.age !== undefined) {
                const meetsThreshold = meetsDateThreshold(comment.createdAt, rule.age);
                if (!meetsThreshold) {
                    this.log(`Post ${comment.id} does not match age condition (${rule.age}).`);
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
                this.log(`Comment ${comment.id} does not match search conditions.`);
                continue;
            }
            matches.push(...searchMatches);

            // Parent submissions
            if (rule.parent_submission !== undefined) {
                const parentSubmission = await this.getPostById(comment.postId as T3);
                if (!await this.checkPostAgainstCondition(parentSubmission, rule.parent_submission, "parentSubmission")) {
                    this.log(`Comment ${comment.id} does not match parent_submission condition.`);
                    continue;
                }
            }

            if (rule.author) {
                const authorMatches = await this.authorMatchesCondition(authorName, rule.author);
                if (!authorMatches) {
                    this.log(`Comment ${comment.id} does not match author condition.`);
                    continue;
                }

                if (rule.author.is_submitter !== undefined) {
                    const parentSubmission = await this.getPostById(comment.postId as T3);
                    if (rule.author.is_submitter !== (parentSubmission.authorName === authorName)) {
                        this.log(`Comment ${comment.id} does not match is_submitter condition (${rule.author.is_submitter}).`);
                        continue;
                    }
                }
            }

            if (rule.is_edited !== undefined) {
                const fullCommentObject = await this.getCommentById(comment.id as T1);
                if (fullCommentObject.edited !== rule.is_edited) {
                    this.log(`Comment ${comment.id} does not match is_edited condition (${rule.is_edited}).`);
                    continue;
                }
            }

            if (rule.moderators_exempt !== false) {
                if (await this.getIsUserModerator(authorName)) {
                    console.log(`Skipping comment ${comment.id} because author is a moderator and rule does not exempt moderators.`);
                    continue;
                }
            }

            console.log(`Rule matched for comment ${comment.id}: ${rule.friendly_name ?? "Unnamed rule"}`);

            results.push({ rule, matches });
            if (this.shouldStop(rule)) {
                console.log(`Stopping further rule checks for comment ${comment.id} because rule has stop_on_match set to true or action is remove/spam/filter.`);
                break;
            }
        }

        return results;
    }

    public async checkPost (postId: T3): Promise<AutomodMatch[]> {
        if (this.rules.length === 0) {
            return [];
        }

        const results: AutomodMatch[] = [];

        for (const rule of this.rules) {
            if (rule.type === "comment") {
                continue;
            }

            this.verboseLogs = rule.verbose_logs ?? false;

            const post = await this.getPostById(postId);

            const isSelfPost = post.url.includes(post.permalink);

            if (rule.type === "text submission" && !isSelfPost) {
                this.log(`Post ${post.id} does not match text submission condition because it is not a self post.`);
                continue;
            }

            if (rule.type === "link submission" && isSelfPost) {
                this.log(`Post ${post.id} does not match link submission condition because it is a self post.`);
                continue;
            }

            if (rule.type === "crosspost submission" && !post.crosspostParentId) {
                this.log(`Post ${post.id} does not match crosspost submission condition because it is not a crosspost.`);
                continue;
            }

            if (rule.type === "gallery submission" && post.gallery.length === 0) {
                this.log(`Post ${post.id} does not match gallery submission condition because it is not a gallery.`);
                continue;
            }

            if (rule.type === "poll submission" && !post.pollData) {
                this.log(`Post ${post.id} does not match poll submission condition because it is not a poll.`);
                continue;
            }

            const matches = await this.checkPostAgainstCondition(post, rule);
            if (!matches) {
                this.log(`Post ${post.id} does not match conditions.`);
                continue;
            }

            if (rule.moderators_exempt !== false) {
                if (await this.getIsUserModerator(post.authorName)) {
                    console.log(`Skipping post ${post.id} because author is a moderator and rule does not exempt moderators.`);
                    continue;
                }
            }

            console.log(`Rule matched for post ${post.id}: ${rule.friendly_name ?? "Unnamed rule"}`);

            results.push({ rule, matches });
            if (this.shouldStop(rule)) {
                console.log(`Stopping further rule checks for post ${post.id} because rule has stop_on_match set to true or action is remove/spam/filter.`);
                break;
            }
        }

        return results;
    }
}
