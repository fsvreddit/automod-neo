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

import { sortRulesForExecution } from "./checkRule.js";
import { AutomodRule } from "../types";

describe("sortRulesForExecution", () => {
    it("orders by priority descending with missing priority treated as zero", () => {
        const rules: AutomodRule[] = [
            { id: ["no-priority"] },
            { id: ["low"], priority: 1 },
            { id: ["high"], priority: 5 },
            { id: ["negative"], priority: -1 },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.id?.[0]),
            ["high", "low", "no-priority", "negative"],
        );
    });

    it("orders same-priority rules by action precedence: remove/spam, then filter, then others", () => {
        const rules: AutomodRule[] = [
            { id: ["other-a"], priority: 2, action: "approve" },
            { id: ["filter"], priority: 2, action: "filter" },
            { id: ["spam"], priority: 2, action: "spam" },
            { id: ["other-b"], priority: 2 },
            { id: ["remove"], priority: 2, action: "remove" },
            { id: ["report"], priority: 2, action: "report" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.id?.[0]),
            ["spam", "remove", "filter", "other-a", "other-b", "report"],
        );
    });

    it("keeps original order when priority and action precedence are equal", () => {
        const rules: AutomodRule[] = [
            { id: ["first"], priority: 0, action: "approve" },
            { id: ["second"], priority: 0, action: "report" },
            { id: ["third"], priority: 0 },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.id?.[0]),
            ["first", "second", "third"],
        );
    });

    it("applies action precedence only within the same priority bucket", () => {
        const rules: AutomodRule[] = [
            { id: ["priority-3-other"], priority: 3, action: "approve" },
            { id: ["priority-2-remove"], priority: 2, action: "remove" },
            { id: ["priority-3-filter"], priority: 3, action: "filter" },
        ];

        const sorted = sortRulesForExecution(rules);

        assert.deepEqual(
            sorted.map(rule => rule.id?.[0]),
            ["priority-3-filter", "priority-3-other", "priority-2-remove"],
        );
    });
});
