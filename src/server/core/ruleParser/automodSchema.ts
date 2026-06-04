/* eslint-disable camelcase */
import { JSONSchemaType } from "ajv";
import { SearchMethod, SearchOption } from "../types";

const searchMethodValues: SearchMethod[] = ["includes-word", "includes", "starts-with", "ends-with", "full-exact", "regex"];
const standardConditionValues = ["image hosting sites", "direct image links", "video hosting sites", "streaming sites", "crowdfunding sites", "meme generator sites", "facebook links", "amazon affiliate links"] as const;
const actionValues = ["approve", "remove", "report", "spam", "filter"] as const;
const submissionTypeValues = ["comment", "submission", "text submission", "link submission", "crosspost submission", "poll submission", "gallery submission", "any"] as const;
const suggestedSortValues = ["best", "new", "qa", "top", "controversial", "hot", "old", "random", "blank"] as const;
const crowdControlValues = ["OFF", "LENIENT", "MEDIUM", "STRICT"] as const;

const searchOptionSchema: JSONSchemaType<SearchOption> = {
    type: "object",
    properties: {
        search_method: { type: "string", enum: searchMethodValues },
        case_sensitive: { type: "boolean", nullable: true },
        negate: { type: "boolean", nullable: true },
    },
    required: ["search_method"],
    additionalProperties: false,
};

const searchableTextSchema = {
    type: "object",
    properties: {
        text: {
            type: "array",
            items: { type: "string" },
        },
        options: {
            ...searchOptionSchema,
            nullable: true,
        },
    },
    required: ["text"],
    additionalProperties: false,
} as const;

const setFlairActionDictionarySchema = {
    type: "object",
    properties: {
        text: { type: "string", nullable: true },
        css_class: { type: "string", nullable: true },
        template_id: { type: "string" },
    },
    required: ["template_id"],
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
        id: {
            type: "array",
            items: { type: "string" },
            nullable: true,
        },
        name: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_text: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_css_class: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        display_name: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        bio_text: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        social_links: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        comment_karma: { type: "string", nullable: true },
        post_karma: { type: "string", nullable: true },
        combined_karma: { type: "string", nullable: true },
        comment_subreddit_karma: { type: "string", nullable: true },
        post_subreddit_karma: { type: "string", nullable: true },
        combined_subreddit_karma: { type: "string", nullable: true },
        account_age: { type: "string", nullable: true },
        satisfy_any_threshold: { type: "boolean", nullable: true },
        has_verified_email: { type: "boolean", nullable: true },
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
        name: {
            type: "array",
            items: searchableTextSchema,
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
        id: {
            type: "array",
            items: { type: "string" },
            nullable: true,
        },
        standard: {
            type: "string",
            enum: standardConditionValues,
            nullable: true,
        },
        title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        body: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        title_or_body: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        ignore_blockquotes: { type: "boolean", nullable: true },
        domain: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        url: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_text: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_css_class: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_template_id: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        reports: { type: "number", nullable: true },
        body_longer_than: { type: "number", nullable: true },
        body_shorter_than: { type: "number", nullable: true },
        is_edited: { type: "boolean", nullable: true },
        is_poll: { type: "boolean", nullable: true },
        is_gallery: { type: "boolean", nullable: true },
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
        crosspost_title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_author: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_author_url: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_description: {
            type: "array",
            items: searchableTextSchema,
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
    },
    required: [],
    additionalProperties: false,
} as const;

export const automodSchema: Record<string, unknown> = {
    type: "object",
    properties: {
        type: {
            type: "string",
            enum: submissionTypeValues,
            nullable: true,
        },
        priority: { type: "number", nullable: true },
        moderators_exempt: { type: "boolean", nullable: true },
        comment: { type: "string", nullable: true },
        comment_locked: { type: "boolean", nullable: true },
        comment_stickied: { type: "boolean", nullable: true },
        modmail: { type: "string", nullable: true },
        modmail_subject: { type: "string", nullable: true },
        message: { type: "string", nullable: true },
        message_subject: { type: "string", nullable: true },
        standard: {
            type: "string",
            enum: standardConditionValues,
            nullable: true,
        },
        id: {
            type: "array",
            items: { type: "string" },
            nullable: true,
        },
        title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        body: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        title_or_body: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        ignore_blockquotes: { type: "boolean", nullable: true },
        domain: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        url: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_text: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_css_class: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        flair_template_id: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        reports: { type: "number", nullable: true },
        body_longer_than: { type: "number", nullable: true },
        body_shorter_than: { type: "number", nullable: true },
        is_edited: { type: "boolean", nullable: true },
        is_poll: { type: "boolean", nullable: true },
        is_gallery: { type: "boolean", nullable: true },
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
        crosspost_title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_author: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_author_url: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_title: {
            type: "array",
            items: searchableTextSchema,
            nullable: true,
        },
        media_description: {
            type: "array",
            items: searchableTextSchema,
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
