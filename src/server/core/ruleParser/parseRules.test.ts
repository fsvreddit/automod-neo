/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { parseRules } from "./parseRules";

describe("parseRules", () => {
    it("parses a simple rule correctly", () => {
        const rules = `
---
title (includes): "Hello World"
body (regex): "foo\\d+bar"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                title: [
                    {
                        text: [
                            "Hello World",
                        ],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                body: [
                    {
                        text: [
                            "foo\\d+bar",
                        ],
                        options: {
                            search_method: "regex",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
            },
        ]);
    });

    it("parses rules with negation correctly", () => {
        const rules = `
---
~title: text
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                title: [
                    {
                        text: [
                            "text",
                        ],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: true,
                        },
                    },
                ],
            },
        ]);
    });
});
