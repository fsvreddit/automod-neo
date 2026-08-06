import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    context: { subredditName: "test" },
    reddit: {},
    settings: {
        // eslint-disable-next-line @typescript-eslint/require-await
        get: vi.fn(async () => "UTC"),
    },
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

import type { CommentV2 } from "@devvit/web/shared";
import { AutomodRuleChecker } from "./ruleChecker.js";

const comment = {
    id: "t1_comment",
    body: "matching body",
    numReports: 0,
    parentId: "t3_parent",
    postId: "t3_parent",
    collapsedBecauseCrowdControl: false,
} as CommentV2;

describe("AutomodRuleChecker.checkComment", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-07T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("treats an omitted rule type as any", async () => {
        const checker = new AutomodRuleChecker({
            rules: [{
                moderators_exempt: false,
                search_conditions: [{
                    searchField: ["body"],
                    text: ["matching"],
                    options: {
                        search_method: "includes",
                        case_sensitive: false,
                        negate: false,
                    },
                }],
            }],
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 1);
        assert.equal(results[0]?.rule.type, undefined);
    });

    it("matches when day_of_week includes the current day", async () => {
        const checker = new AutomodRuleChecker({
            rules: [{
                moderators_exempt: false,
                day_of_week: ["wednesday"],
                search_conditions: [{
                    searchField: ["body"],
                    text: ["matching"],
                    options: {
                        search_method: "includes",
                        case_sensitive: false,
                        negate: false,
                    },
                }],
            }],
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 1);
    });

    it("does not match when day_of_week excludes the current day", async () => {
        const checker = new AutomodRuleChecker({
            rules: [{
                moderators_exempt: false,
                day_of_week: ["thursday"],
                search_conditions: [{
                    searchField: ["body"],
                    text: ["matching"],
                    options: {
                        search_method: "includes",
                        case_sensitive: false,
                        negate: false,
                    },
                }],
            }],
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 0);
    });

    it("does not match when ~day_of_week contains the current day", async () => {
        const checker = new AutomodRuleChecker({
            rules: [{
                moderators_exempt: false,
                "~day_of_week": ["wednesday"],
                search_conditions: [{
                    searchField: ["body"],
                    text: ["matching"],
                    options: {
                        search_method: "includes",
                        case_sensitive: false,
                        negate: false,
                    },
                }],
            }],
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 0);
    });

    it("matches when ~day_of_week does not contain the current day", async () => {
        const checker = new AutomodRuleChecker({
            rules: [{
                moderators_exempt: false,
                "~day_of_week": ["thursday"],
                search_conditions: [{
                    searchField: ["body"],
                    text: ["matching"],
                    options: {
                        search_method: "includes",
                        case_sensitive: false,
                        negate: false,
                    },
                }],
            }],
        });

        const results = await checker.checkComment(comment, "example_author");

        assert.equal(results.length, 1);
    });
});
