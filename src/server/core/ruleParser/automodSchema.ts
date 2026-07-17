/* eslint-disable camelcase */
import { JSONSchemaType } from "ajv";
import { SearchMethod, SearchOption } from "../types";
import { dateComparatorPattern, numericComparatorPattern } from "../ruleExecution";

const searchMethodValues: SearchMethod[] = ["includes-word", "includes", "starts-with", "ends-with", "domain", "full-exact", "full-text", "regex"];
const standardConditionValues = ["image hosting sites", "direct image links", "video hosting sites", "streaming sites", "crowdfunding sites", "meme generator sites", "facebook links", "amazon affiliate links"] as const;
const actionValues = ["approve", "remove", "report", "spam", "filter"] as const;
const submissionTypeValues = ["comment", "submission", "text submission", "link submission", "crosspost submission", "poll submission", "gallery submission", "any"] as const;
const suggestedSortValues = ["best", "new", "qa", "top", "controversial", "hot", "old", "random", "blank"] as const;
const crowdControlValues = ["OFF", "LENIENT", "MEDIUM", "STRICT"] as const;
const postSearchFieldValues = ["id", "title", "body", "domain", "url", "flair_text", "flair_css_class", "flair_template_id", "crosspost_title", "media_author", "media_author_url", "media_title"] as const;
const authorSearchFieldValues = ["id", "name", "flair_text", "flair_css_class", "display_name", "bio_text", "social_links"] as const;
const subredditSearchFieldValues = ["name"] as const;

const searchOptionSchema: JSONSchemaType<SearchOption> = {
    type: "object",
    properties: {
        search_method: { type: "string", enum: searchMethodValues },
        case_sensitive: { type: "boolean" },
        negate: { type: "boolean" },
    },
    required: ["search_method", "case_sensitive", "negate"],
    additionalProperties: false,
};

function createSearchableTextSchema (searchFieldEnum: readonly string[]) {
    return {
        type: "object",
        properties: {
            searchField: {
                type: "array",
                items: { type: "string", enum: searchFieldEnum },
                minItems: 1,
            },
            text: {
                type: "array",
                items: { type: "string" },
            },
            options: {
                ...searchOptionSchema,
            },
        },
        required: ["searchField", "text", "options"],
        additionalProperties: false,
    } as const;
}

const postSearchableTextSchema = createSearchableTextSchema(postSearchFieldValues);
const authorSearchableTextSchema = createSearchableTextSchema(authorSearchFieldValues);
const subredditSearchableTextSchema = createSearchableTextSchema(subredditSearchFieldValues);

const setFlairActionDictionarySchema = {
    type: "object",
    properties: {
        text: { type: "string", nullable: true },
        css_class: { type: "string", nullable: true },
        template_id: { type: "string", nullable: true },
    },
    additionalProperties: false,
} as const;

const setFlairSchema = {
    anyOf: [
        { type: "string" },
        {
            type: "array",
            items: { type: "string" },
            maxItems: 2,
        },
        setFlairActionDictionarySchema,
        { type: "null" },
    ],
} as const;

const authorSchema = {
    type: "object",
    properties: {
        search_conditions: {
            type: "array",
            items: authorSearchableTextSchema,
            nullable: true,
        },
        comment_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        post_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        combined_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        comment_subreddit_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        post_subreddit_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        combined_subreddit_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
        account_age: { type: "string", nullable: true, pattern: dateComparatorPattern },
        satisfy_any_threshold: { type: "boolean", nullable: true },
        has_verified_email: { type: "boolean", nullable: true },
        is_nsfw: { type: "boolean", nullable: true },
        is_gold: { type: "boolean", nullable: true },
        is_submitter: { type: "boolean", nullable: true },
        is_contributor: { type: "boolean", nullable: true },
        is_moderator: { type: "boolean", nullable: true },
        set_flair: {
            ...setFlairSchema,
        },
        overwrite_flair: { type: "boolean", nullable: true },
    },
    required: [],
    additionalProperties: false,
} as const;

const subredditSchema = {
    type: "object",
    properties: {
        search_conditions: {
            type: "array",
            items: subredditSearchableTextSchema,
            nullable: true,
        },
        is_nsfw: { type: "boolean", nullable: true },
    },
    required: [],
    additionalProperties: false,
} as const;

const postConditionSchema = {
    type: "object",
    properties: {
        standard: {
            type: "string",
            enum: standardConditionValues,
            nullable: true,
        },
        search_conditions: {
            type: "array",
            items: postSearchableTextSchema,
            nullable: true,
        },
        ignore_blockquotes: { type: "boolean", nullable: true },
        reports: { type: "number", nullable: true },
        body_longer_than: { type: "number", nullable: true },
        body_shorter_than: { type: "number", nullable: true },
        is_nsfw: { type: "boolean", nullable: true },
        is_edited: { type: "boolean", nullable: true },
        is_poll: { type: "boolean", nullable: true },
        is_gallery: { type: "boolean", nullable: true },
        poll_option_count: { type: "string", nullable: true, pattern: numericComparatorPattern },
        age: { type: "string", nullable: true, pattern: dateComparatorPattern },
        past_archive_date: { type: "boolean", nullable: true },
        author: {
            ...authorSchema,
            nullable: true,
        },
        subreddit: {
            ...subredditSchema,
            nullable: true,
        },
        crosspost_id: {
            type: "array",
            items: { type: "string" },
            nullable: true,
        },
        crosspost_author: {
            ...authorSchema,
            nullable: true,
        },
        crosspost_subreddit: {
            ...subredditSchema,
            nullable: true,
        },
        action: {
            type: "string",
            enum: actionValues,
            nullable: true,
        },
        action_reason: { type: "string", nullable: true },
        report_reason: { type: "string", nullable: true },
        set_flair: {
            ...setFlairSchema,
        },
        overwrite_flair: { type: "boolean", nullable: true },
        set_sticky: {
            anyOf: [
                { type: "boolean" },
                { type: "number", enum: [1, 2, 3, 4] },
                { type: "null" },
            ],
        },
        set_nsfw: { type: "boolean", nullable: true },
        set_spoiler: { type: "boolean", nullable: true },
        set_contest_mode: { type: "boolean", nullable: true },
        set_original_content: { type: "boolean", nullable: true },
        set_suggested_sort: {
            type: "string",
            enum: suggestedSortValues,
            nullable: true,
        },
        set_locked: { type: "boolean", nullable: true },
        set_post_crowd_control_level: {
            type: "string",
            enum: crowdControlValues,
            nullable: true,
        },
    },
    required: [],
    additionalProperties: false,
} as const;

export const automodSchema: Record<string, unknown> = {
    type: "object",
    properties: {
        friendly_name: { type: "string", nullable: true },
        verbose_logs: { type: "boolean", nullable: true },
        type: {
            type: "string",
            enum: submissionTypeValues,
            nullable: true,
        },
        priority: { type: "number", nullable: true },
        day_of_week: {
            type: "array",
            items: {
                type: "string",
                enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "weekday", "weekend"],
            },
            nullable: true,
        },
        moderators_exempt: { type: "boolean", nullable: true },
        comment: { type: "string", nullable: true },
        comment_locked: { type: "boolean", nullable: true },
        comment_stickied: { type: "boolean", nullable: true },
        modmail: { type: "string", nullable: true },
        modmail_subject: { type: "string", nullable: true },
        message: { type: "string", nullable: true },
        message_subject: { type: "string", nullable: true },
        discord_alert: { type: "string", nullable: true },
        stop_on_match: { type: "boolean", nullable: true },
        standard: {
            type: "string",
            enum: standardConditionValues,
            nullable: true,
        },
        search_conditions: {
            type: "array",
            items: postSearchableTextSchema,
            nullable: true,
        },
        ignore_blockquotes: { type: "boolean", nullable: true },
        reports: { type: "number", nullable: true },
        body_longer_than: { type: "number", nullable: true },
        body_shorter_than: { type: "number", nullable: true },
        is_edited: { type: "boolean", nullable: true },
        is_poll: { type: "boolean", nullable: true },
        is_gallery: { type: "boolean", nullable: true },
        poll_option_count: { type: "string", nullable: true, pattern: numericComparatorPattern },
        past_archive_date: { type: "boolean", nullable: true },
        is_top_level: { type: "boolean", nullable: true },
        comment_crowd_control_collapsed: { type: "boolean", nullable: true },
        action: {
            type: "string",
            enum: actionValues,
            nullable: true,
        },
        action_reason: { type: "string", nullable: true },
        report_reason: { type: "string", nullable: true },
        set_flair: {
            ...setFlairSchema,
        },
        overwrite_flair: { type: "boolean", nullable: true },
        set_sticky: {
            anyOf: [
                { type: "boolean" },
                { type: "number", enum: [1, 2, 3, 4] },
                { type: "null" },
            ],
        },
        set_nsfw: { type: "boolean", nullable: true },
        set_spoiler: { type: "boolean", nullable: true },
        set_contest_mode: { type: "boolean", nullable: true },
        set_original_content: { type: "boolean", nullable: true },
        set_suggested_sort: {
            type: "string",
            enum: suggestedSortValues,
            nullable: true,
        },
        set_locked: { type: "boolean", nullable: true },
        set_post_crowd_control_level: {
            type: "string",
            enum: crowdControlValues,
            nullable: true,
        },
        author: {
            ...authorSchema,
            nullable: true,
        },
        crosspost_id: {
            type: "array",
            items: { type: "string" },
            nullable: true,
        },
        crosspost_author: {
            ...authorSchema,
            nullable: true,
        },
        crosspost_subreddit: {
            ...subredditSchema,
            nullable: true,
        },
        subreddit: {
            ...subredditSchema,
            nullable: true,
        },
        parent_submission: {
            ...postConditionSchema,
            nullable: true,
        },
    },
    required: [],
    additionalProperties: false,
};
