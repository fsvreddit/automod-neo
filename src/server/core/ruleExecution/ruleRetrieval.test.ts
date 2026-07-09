import assert from "node:assert/strict";
import { describe, it } from "vitest";

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

    it("orders removal rules before other rules, each bucket by priority descending", () => {
        const rules: AutomodRule[] = [
            { comment: "other-high", priority: 5, action: "approve" },
            { comment: "remove-low", priority: 1, action: "remove" },
            { comment: "spam-high", priority: 4, action: "spam" },
            { comment: "filter-mid", priority: 3, action: "filter" },
            { comment: "other-mid", priority: 3 },
            { comment: "other-low", priority: 1, action: "report" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["spam-high", "filter-mid", "remove-low", "other-high", "other-mid", "other-low"],
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

    it("keeps removal and non-removal groups independently ordered by priority", () => {
        const rules: AutomodRule[] = [
            { comment: "other-high", priority: 8, action: "approve" },
            { comment: "remove-low", priority: 1, action: "remove" },
            { comment: "spam-mid", priority: 5, action: "spam" },
            { comment: "other-mid", priority: 5 },
            { comment: "filter-high", priority: 9, action: "filter" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.comment),
            ["filter-high", "spam-mid", "remove-low", "other-high", "other-mid"],
        );
    });
});
