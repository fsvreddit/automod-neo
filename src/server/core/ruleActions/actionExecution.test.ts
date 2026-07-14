/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getPostOrCommentById: vi.fn(),
    getPostById: vi.fn(),
    getUserByUsername: vi.fn(),
    report: vi.fn(),
    setUserFlair: vi.fn(),
    submitComment: vi.fn(),
    settingsGet: vi.fn(),
}));

vi.mock("@devvit/web/server", () => ({
    context: {
        subredditId: "t5_test",
        subredditName: "test",
    },
    reddit: {
        getPostById: mocks.getPostById,
        getUserByUsername: mocks.getUserByUsername,
        report: mocks.report,
        setUserFlair: mocks.setUserFlair,
        submitComment: mocks.submitComment,
        sendPrivateMessage: vi.fn(),
        modMail: {
            createModInboxConversation: vi.fn(),
        },
    },
    settings: {
        get: mocks.settingsGet,
    },
}));

vi.mock("@devvit/web/shared", () => ({
    isT1: (id: string) => id.startsWith("t1_"),
    isT3: (id: string) => id.startsWith("t3_"),
}));

vi.mock("@fsvreddit/fsv-devvit-web-helpers", () => ({
    getPostOrCommentById: mocks.getPostOrCommentById,
}));

vi.mock("../helpers", () => ({
    getBotCommentFooter: () => "footer",
    getDomainFromUrl: () => "example.com",
    sendMessageToWebhook: vi.fn(),
}));

import type { Comment, Post } from "@devvit/web/server";
import type { T1, T3 } from "@devvit/web/shared";
import type { AutomodMatch, AutomodRule } from "../types";
import { ActionRules } from "./actionRules";

function makePost (overrides: Record<string, unknown> = {}): Post {
    return {
        id: "t3_post",
        authorName: "post_author",
        body: "body",
        permalink: "/r/test/comments/post/example",
        subredditName: "test",
        title: "title",
        url: "https://example.com",
        approved: false,
        removed: false,
        lock: vi.fn(),
        unlock: vi.fn(),
        ...overrides,
    } as unknown as Post;
}

function makeComment (overrides: Record<string, unknown> = {}): Comment {
    return {
        id: "t1_comment",
        postId: "t3_parent",
        authorName: "comment_author",
        body: "body",
        permalink: "/r/test/comments/parent/example/comment",
        subredditName: "test",
        url: "https://example.com",
        approved: false,
        removed: false,
        lock: vi.fn(),
        unlock: vi.fn(),
        ...overrides,
    } as unknown as Comment;
}

function match (rule: AutomodRule): AutomodMatch {
    return {
        rule,
        matches: [],
    };
}

describe("ActionRules action execution", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserByUsername.mockResolvedValue(undefined);
        mocks.settingsGet.mockResolvedValue(false);
    });

    it("runs a post's top-level action only once", async () => {
        const post = makePost();
        mocks.getPostOrCommentById.mockResolvedValue(post);

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({ action: "report", report_reason: "test" })],
        });
        await actionRules.actionRules();

        assert.equal(mocks.report.mock.calls.length, 1);
    });

    it("continues to execute a parent submission's top-level action", async () => {
        const comment = makeComment();
        const parentPost = makePost({ id: "t3_parent" });
        mocks.getPostOrCommentById.mockResolvedValue(comment);
        mocks.getPostById.mockResolvedValue(parentPost);

        const actionRules = new ActionRules({
            targetId: comment.id as T1,
            matchedRules: [match({
                parent_submission: {
                    action: "report",
                    report_reason: "parent report",
                },
            })],
        });
        await actionRules.actionRules();

        assert.equal(mocks.report.mock.calls.length, 1);
        assert.equal(mocks.report.mock.calls[0]?.[0], parentPost);
    });

    it("sets author flair when no existing flair is present", async () => {
        const post = makePost();
        const getUserFlairBySubreddit = vi.fn().mockResolvedValue(undefined);
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.getUserByUsername.mockResolvedValue({ getUserFlairBySubreddit });

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({
                author: {
                    set_flair: "New flair",
                },
            })],
        });
        await actionRules.actionRules();

        assert.equal(getUserFlairBySubreddit.mock.calls.length, 1);
        assert.equal(mocks.setUserFlair.mock.calls.length, 1);
        assert.equal(mocks.setUserFlair.mock.calls[0]?.[0].username, "post_author");
    });

    it("preserves existing author flair unless overwrite_flair is true", async () => {
        const post = makePost();
        const getUserFlairBySubreddit = vi.fn().mockResolvedValue({ flairText: "Existing flair" });
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.getUserByUsername.mockResolvedValue({ getUserFlairBySubreddit });

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({
                author: {
                    set_flair: "New flair",
                },
            })],
        });
        await actionRules.actionRules();

        assert.equal(mocks.setUserFlair.mock.calls.length, 0);
    });

    it("stickies a generated comment when the target is a post", async () => {
        const post = makePost();
        const distinguish = vi.fn();
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.submitComment.mockResolvedValue({
            distinguish,
            lock: vi.fn(),
        });

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({
                comment: "Moderator notice",
                comment_stickied: true,
            })],
        });
        await actionRules.actionRules();

        assert.deepEqual(distinguish.mock.calls[0], [true]);
    });

    it("locks an item when set_locked is true", async () => {
        const lock = vi.fn();
        const unlock = vi.fn();
        const post = makePost({ lock, unlock });
        mocks.getPostOrCommentById.mockResolvedValue(post);

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({ set_locked: true })],
        });
        await actionRules.actionRules();

        assert.equal(lock.mock.calls.length, 1);
        assert.equal(unlock.mock.calls.length, 0);
    });

    it("unlocks an item when set_locked is false", async () => {
        const lock = vi.fn();
        const unlock = vi.fn();
        const post = makePost({ lock, unlock });
        mocks.getPostOrCommentById.mockResolvedValue(post);

        const actionRules = new ActionRules({
            targetId: post.id as T3,
            matchedRules: [match({ set_locked: false })],
        });
        await actionRules.actionRules();

        assert.equal(unlock.mock.calls.length, 1);
        assert.equal(lock.mock.calls.length, 0);
    });
});
