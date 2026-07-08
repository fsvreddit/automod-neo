import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    reddit: {},
}));

vi.mock("./commentChecks", () => ({
    commentMatchesRule: vi.fn(),
}));

vi.mock("./postChecks", () => ({
    postMatchesRule: vi.fn(),
}));

vi.mock("./authorChecks", () => ({
    authorMatchesCondition: vi.fn(),
}));

vi.mock("../helpers", () => ({
    isModerator: vi.fn(),
}));

vi.mock("@fsvreddit/fsv-devvit-web-helpers", () => ({
    hasTriggerBeenHandled: vi.fn(),
}));

vi.mock("../appSettings", () => ({
    AppSetting: { Rules: "Rules" },
    getSettings: vi.fn(),
}));

vi.mock("../ruleParser", () => ({
    parseRules: vi.fn(),
}));

import { AutomodRule } from "../types.js";
import { sortRulesForExecution } from "./ruleRetrieval.js";

describe("sortRulesForExecution", () => {
    it("orders by priority descending with missing priority treated as zero", () => {
        const rules: AutomodRule[] = [
            { comment: "no-priority" },
            { comment: "low", priority: 1 },
            { comment: "high", priority: 5 },
            { comment: "negative", priority: -1 },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["high", "low", "no-priority", "negative"],
        );
    });

    it("orders same-priority rules by action precedence: remove/spam, then filter, then report, then others", () => {
        const rules: AutomodRule[] = [
            { comment: "other-a", priority: 2, action: "approve" },
            { comment: "filter", priority: 2, action: "filter" },
            { comment: "spam", priority: 2, action: "spam" },
            { comment: "other-b", priority: 2 },
            { comment: "remove", priority: 2, action: "remove" },
            { comment: "report", priority: 2, action: "report" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["spam", "remove", "filter", "report", "other-a", "other-b"],
        );
    });

    it("keeps original order when priority and action precedence are equal", () => {
        const rules: AutomodRule[] = [
            { comment: "first", priority: 0, action: "approve" },
            { comment: "second", priority: 0 },
            { comment: "third", priority: 0 },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["first", "second", "third"],
        );
    });

    it("applies action precedence only within the same priority bucket", () => {
        const rules: AutomodRule[] = [
            { comment: "priority-3-other", priority: 3, action: "approve" },
            { comment: "priority-2-remove", priority: 2, action: "remove" },
            { comment: "priority-3-filter", priority: 3, action: "filter" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["priority-3-filter", "priority-3-other", "priority-2-remove"],
        );
    });
});
