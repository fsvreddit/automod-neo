export type SearchMethod = "includes-word" | "includes" | "starts-with" | "ends-with" | "full-exact" | "regex";

export interface SearchOption {
    search_method: SearchMethod;
    case_sensitive?: boolean;
    negate?: boolean;
}

export interface SearchableText {
    text: string[];
    options?: SearchOption;
}

export interface SetFlairActionDictionary {
    text?: string;
    css_class?: string;
    template_id: string;
}

export interface Author {
    id?: string[];
    name?: SearchableText[];
    flair_text?: SearchableText[];
    flair_css_class?: SearchableText[];
    comment_karma?: string;
    post_karma?: string;
    combined_karma?: string;
    comment_subreddit_karma?: string;
    post_subreddit_karma?: string;
    combined_subreddit_karma?: string;
    account_age?: string;
    satisfy_any_threshold?: boolean;
    has_verified_email?: boolean;
    is_gold?: boolean;
    is_submitter?: boolean;
    is_contributor?: boolean;
    is_moderator?: boolean;
    display_name?: SearchableText[];
    bio_text?: SearchableText[];
    social_links?: SearchableText[];

    set_flair?: string | string[] | SetFlairActionDictionary;
    overwrite_flair?: boolean;
}

export interface Subreddit {
    name?: SearchableText[];
    is_nsfw?: boolean;
}

interface SubmissionAction {
    action?: "approve" | "remove" | "report" | "spam" | "filter";
    action_reason?: string;
    set_flair?: string | string[] | SetFlairActionDictionary;
    overwrite_flair?: boolean;
    set_sticky?: boolean | 1 | 2 | 3 | 4;
    set_nsfw?: boolean;
    set_spoiler?: boolean;
    set_contest_mode?: boolean;
    set_original_content?: boolean;
    set_suggested_sort?: "best" | "new" | "qa" | "top" | "controversial" | "hot" | "old" | "random" | "blank";
    set_locked?: boolean;
    set_post_crowd_control_level?: "OFF" | "LENIENT" | "MEDIUM" | "STRICT";
}

interface CommentAction {
    action?: "approve" | "remove" | "report" | "spam" | "filter";
    report_reason?: string;
}

export type StandardCondition = "image hosting sites" | "direct image links" | "video hosting sites" | "streaming sites" | "crowdfunding sites" | "meme generator sites" | "facebook links" | "amazon affiliate links";

export interface PostCondition {
    // Search checks
    id?: string[];
    standard?: StandardCondition;
    title?: SearchableText[];
    body?: SearchableText[];
    title_or_body?: SearchableText[];
    ignore_blockquotes?: boolean;
    domain?: SearchableText[];
    url?: SearchableText[];
    flair_text?: SearchableText[];
    flair_css_class?: SearchableText[];
    flair_template_id?: SearchableText[];

    reports?: number;
    body_longer_than?: number;
    body_shorter_than?: number;
    is_edited?: boolean;
    is_poll?: boolean; // Posts only
    is_gallery?: boolean; // Posts only
    past_archive_date?: boolean;

    author?: Author;
    subreddit?: Subreddit;

    crosspost_id?: string[];
    crosspost_title?: SearchableText[];
    crosspost_author?: Author;
    crosspost_subreddit?: Subreddit;

    media_author?: SearchableText[];
    media_author_url?: SearchableText[];
    media_title?: SearchableText[];
    media_description?: SearchableText[];
}

export type AutomodRule = PostCondition & SubmissionAction & CommentAction & {
    // Top-level checks/actions
    type?: "comment" | "submission" | "text submission" | "link submission" | "crosspost submission" | "poll submission" | "gallery submission" | "any";
    priority?: number;
    moderators_exempt?: boolean;
    comment?: string;
    comment_locked?: boolean;
    comment_stickied?: boolean;
    modmail?: string;
    modmail_subject?: string;
    message?: string;
    message_subject?: string;
    standard?: StandardCondition;

    // Search checks
    id?: string[];
    title?: SearchableText[];
    body?: SearchableText[];
    title_or_body?: SearchableText[];
    ignore_blockquotes?: boolean;
    domain?: SearchableText[];
    url?: SearchableText[];
    flair_text?: SearchableText[];
    flair_css_class?: SearchableText[];
    flair_template_id?: SearchableText[];

    // Non-searching checks
    reports?: number;
    body_longer_than?: number;
    body_shorter_than?: number;
    is_edited?: boolean;
    is_poll?: boolean; // Posts only
    is_gallery?: boolean; // Posts only
    past_archive_date?: boolean;
    is_top_level?: boolean; // Comments only
    comment_crowd_control_collapsed?: boolean; // Comments only

    // Author checks
    author?: Author;
    crosspost_author?: Author;

    // Subreddit checks
    subreddit?: Subreddit;

    parent_submission?: PostCondition; // Comments only
};

export interface Matches {
    category: string;
    matches: string[];
};

export interface AutomodMatch {
    rule: AutomodRule;
    matches: Matches[];
}
