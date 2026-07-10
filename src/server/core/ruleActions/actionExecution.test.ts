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
import { actionRules } from "./actionRules.js";

function makePost (overrides: Partial<Post> = {}): Post {
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

function makeComment (overrides: Partial<Comment> = {}): Comment {
    return {
        id: "t1_comment",
        authorName: "comment_author",
        body: "comment body",
        permalink: "/r/test/comments/post/example/comment",
        subredditName: "test",
        url: "https://www.reddit.com/r/test/comments/post/example/comment",
        postId: "t3_parent",
        approved: false,
        removed: false,
        lock: vi.fn(),
        unlock: vi.fn(),
        ...overrides,
    } as unknown as Comment;
}

describe("actionRules", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserByUsername.mockResolvedValue(undefined);
        mocks.settingsGet.mockResolvedValue(undefined);
    });

    it("runs a post's top-level action only once", async () => {
        const post = makePost();
        mocks.getPostOrCommentById.mockResolvedValue(post);

        await actionRules(post.id, {
            rule: { action: "report", report_reason: "test" },
            matches: [],
        });

        assert.equal(mocks.report.mock.calls.length, 1);
    });

    it("sets author flair when the user has no existing flair", async () => {
        const post = makePost();
        const getUserFlairBySubreddit = vi.fn().mockResolvedValue(undefined);
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.getUserByUsername.mockResolvedValue({ getUserFlairBySubreddit });

        await actionRules(post.id, {
            rule: { author: { set_flair: "New flair" } },
            matches: [],
        });

        assert.equal(mocks.setUserFlair.mock.calls.length, 1);
        assert.equal(mocks.setUserFlair.mock.calls[0]?.[0].username, "post_author");
    });

    it("stickies a generated comment only when it is top-level", async () => {
        const post = makePost();
        const distinguish = vi.fn();
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.submitComment.mockResolvedValue({
            distinguish,
            lock: vi.fn(),
        });

        await actionRules(post.id, {
            rule: { comment: "Moderator notice", comment_stickied: true },
            matches: [],
        });

        assert.deepEqual(distinguish.mock.calls[0], [true]);
    });

    it("unlocks an item when set_locked is false", async () => {
        const post = makePost();
        mocks.getPostOrCommentById.mockResolvedValue(post);

        await actionRules(post.id, {
            rule: { set_locked: false },
            matches: [],
        });

        assert.equal(vi.mocked(post.unlock).mock.calls.length, 1);
        assert.equal(vi.mocked(post.lock).mock.calls.length, 0);
    });

    it("applies crosspost_author flair to the original post author", async () => {
        const post = makePost({ crosspostParentId: "t3_original" });
        const originalPost = makePost({
            id: "t3_original",
            authorName: "original_author",
        });
        const getUserFlairBySubreddit = vi.fn().mockResolvedValue(undefined);
        mocks.getPostOrCommentById.mockResolvedValue(post);
        mocks.getPostById.mockResolvedValue(originalPost);
        mocks.getUserByUsername.mockResolvedValue({ getUserFlairBySubreddit });

        await actionRules(post.id, {
            rule: { crosspost_author: { set_flair: "Original author flair" } },
            matches: [],
        });

        assert.equal(mocks.setUserFlair.mock.calls.length, 1);
        assert.equal(mocks.setUserFlair.mock.calls[0]?.[0].username, "original_author");
    });

    it("executes supported false-valued actions on a parent submission", async () => {
        const comment = makeComment();
        const parentPost = makePost({
            id: "t3_parent",
            unmarkAsNsfw: vi.fn(),
        });
        mocks.getPostOrCommentById.mockResolvedValue(comment);
        mocks.getPostById.mockResolvedValue(parentPost);

        await actionRules(comment.id, {
            rule: {
                parent_submission: {
                    action: "report",
                    report_reason: "Parent report",
                    set_nsfw: false,
                    set_locked: false,
                },
            },
            matches: [],
        });

        assert.equal(mocks.report.mock.calls.length, 1);
        assert.equal(mocks.report.mock.calls[0]?.[0], parentPost);
        assert.equal(vi.mocked(parentPost.unmarkAsNsfw).mock.calls.length, 1);
        assert.equal(vi.mocked(parentPost.unlock).mock.calls.length, 1);
    });

});
