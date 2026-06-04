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

    it("normalizes searchable fields with aliases, qualifiers, and numbered keys", () => {
        const rules = `
---
id: abcde
title+body (includes, case_sensitive): "abcde"
~body#1: dog
~body#2: attack
author:
  name (regex): ['^foo.*']
parent_submission:
  body+title (regex): ['regex1', 'regex2']
  crosspost_title#1: one
  crosspost_title#2: two
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                id: ["abcde"],
                title_or_body: [
                    {
                        text: ["abcde"],
                        options: {
                            search_method: "includes",
                            case_sensitive: true,
                            negate: false,
                        },
                    },
                ],
                body: [
                    {
                        text: ["dog"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: true,
                        },
                    },
                    {
                        text: ["attack"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: true,
                        },
                    },
                ],
                author: {
                    name: [
                        {
                            text: ["^foo.*"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                parent_submission: {
                    title_or_body: [
                        {
                            text: ["regex1", "regex2"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                    crosspost_title: [
                        {
                            text: ["one"],
                        },
                        {
                            text: ["two"],
                        },
                    ],
                },
            },
        ]);
    });

    it("coerces id and searchable text string arrays", () => {
        const rules = `
---
id: ['abcde', 'defgh']
body: ['first', 'second']
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                id: ["abcde", "defgh"],
                body: [
                    {
                        text: ["first", "second"],
                    },
                ],
            },
        ]);
    });

    it("throws when a regex searchable text contains an invalid regular expression", () => {
        const rules = `
---
body (regex): '['
        `;

        assert.throws(
            () => parseRules(rules),
            /Invalid regex pattern at rule\[0\]\.body\[0\]\.text\[0\]/,
        );
    });

    it("validates regex patterns in nested searchable nodes", () => {
        const rules = `
---
parent_submission:
  author:
    name (regex): '^user_[0-9]+$'
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                parent_submission: {
                    author: {
                        name: [
                            {
                                text: ["^user_[0-9]+$"],
                                options: {
                                    search_method: "regex",
                                    case_sensitive: false,
                                    negate: false,
                                },
                            },
                        ],
                    },
                },
            },
        ]);
    });
});
