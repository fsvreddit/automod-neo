/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    context: { subredditName: "test" },
    reddit: {},
    settings: {},
}));

vi.mock("@devvit/web/shared", () => ({
    isT3: (id: string) => id.startsWith("t3_"),
}));

vi.mock("../helpers", () => ({
    getDomainFromUrl: vi.fn(),
    isApprovedUser: vi.fn(),
    isModerator: vi.fn(),
    isRemovalRule: vi.fn(() => false),
    isSubredditNSFW: vi.fn(),
}));

import type { Post } from "@devvit/web/server";
import type { CommentV2 } from "@devvit/web/shared";
import { AutomodRuleChecker } from "./ruleChecker.js";

function makePost (body: string | undefined): Post {
    return {
        id: "t3_parent",
        authorName: "example_author",
        body,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        gallery: [],
        numberOfReports: 0,
        permalink: "/r/test/comments/parent/example/",
        subredditName: "test",
        title: "Example post",
        url: "https://www.reddit.com/r/test/comments/parent/example/",
    } as unknown as Post;
}

const comment = {
    id: "t1_comment",
    body: "comment body",
    numReports: 0,
    parentId: "t3_parent",
    postId: "t3_parent",
    collapsedBecauseCrowdControl: false,
} as CommentV2;

describe("AutomodRuleChecker post body length checks", () => {
    it("enforces body_shorter_than for posts", async () => {
        const checker = new AutomodRuleChecker({ rules: [] });

        assert.notEqual(
            await checker.checkPostAgainstCondition(makePost("123456789"), { body_shorter_than: 10 }),
            undefined,
        );
        assert.equal(
            await checker.checkPostAgainstCondition(makePost("1234567890"), { body_shorter_than: 10 }),
            undefined,
        );
    });

    it("enforces body_longer_than for posts", async () => {
        const checker = new AutomodRuleChecker({ rules: [] });

        assert.notEqual(
            await checker.checkPostAgainstCondition(makePost("12345678901"), { body_longer_than: 10 }),
            undefined,
        );
        assert.equal(
            await checker.checkPostAgainstCondition(makePost("1234567890"), { body_longer_than: 10 }),
            undefined,
        );
    });

    it("enforces parent_submission.body_shorter_than", async () => {
        const matchingRule = {
            type: "comment" as const,
            moderators_exempt: false,
            parent_submission: { body_shorter_than: 6 },
        };
        const failingRule = {
            type: "comment" as const,
            moderators_exempt: false,
            parent_submission: { body_shorter_than: 5 },
        };
        const checker = new AutomodRuleChecker({
            rules: [matchingRule, failingRule],
            post: makePost("12345"),
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 1);
        assert.equal(results[0]?.rule, matchingRule);
    });

    it("enforces parent_submission.body_longer_than", async () => {
        const matchingRule = {
            type: "comment" as const,
            moderators_exempt: false,
            parent_submission: { body_longer_than: 4 },
        };
        const failingRule = {
            type: "comment" as const,
            moderators_exempt: false,
            parent_submission: { body_longer_than: 5 },
        };
        const checker = new AutomodRuleChecker({
            rules: [matchingRule, failingRule],
            post: makePost("12345"),
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 1);
        assert.equal(results[0]?.rule, matchingRule);
    });
});
