import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    context: { subredditName: "test" },
    reddit: {},
}));

vi.mock("@devvit/web/shared", () => ({
    isT3: (id: string) => id.startsWith("t3_"),
}));

vi.mock("../helpers", () => ({
    getDomainFromUrl: vi.fn(),
    isApprovedUser: vi.fn(),
    isModerator: vi.fn(),
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

        const result = await checker.checkComment(comment, "example_author");

        assert.ok(result);
        assert.equal(result.rule.type, undefined);
    });
});
