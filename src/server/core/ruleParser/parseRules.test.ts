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
id#primary: fghij
title+body (includes, case_sensitive): "abcde"
~body#1: dog
~body#2: attack
body#redact: wolf
author:
  name (regex): ['^foo.*']
    display_name (includes): DisplayName
    bio_text (regex): '^bio_.*$'
    social_links#1: 'example.com/a'
    social_links#2: 'example.com/b'
parent_submission:
  body+title (regex): ['regex1', 'regex2']
  crosspost_title#1: one
  crosspost_title#2: two
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                id: ["abcde", "fghij"],
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
                    {
                        text: ["wolf"],
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
                    display_name: [
                        {
                            text: ["DisplayName"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                    bio_text: [
                        {
                            text: ["^bio_.*$"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                    social_links: [
                        {
                            text: ["example.com/a"],
                        },
                        {
                            text: ["example.com/b"],
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

    it("normalizes searchable fields with named key suffixes", () => {
        const rules = `
---
body#redact: alpha
body#review: beta
author:
  social_links#twitter (includes): x.com/example
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                body: [
                    {
                        text: ["alpha"],
                    },
                    {
                        text: ["beta"],
                    },
                ],
                author: {
                    social_links: [
                        {
                            text: ["x.com/example"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
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
        bio_text (regex): '^bio_[a-z]+$'
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
                        bio_text: [
                            {
                                text: ["^bio_[a-z]+$"],
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

    it("throws when a new author searchable field contains an invalid regex", () => {
        const rules = `
---
author:
  bio_text (regex): '('
        `;

        assert.throws(
            () => parseRules(rules),
            /Invalid regex pattern at rule\[0\]\.author\.bio_text\[0\]\.text\[0\]/,
        );
    });

    it("accepts set_flair arrays with at most two elements", () => {
        const rules = `
---
set_flair: ['one', 'two']
author:
  set_flair: ['left', 'right']
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                set_flair: ["one", "two"],
                author: {
                    set_flair: ["left", "right"],
                },
            },
        ]);
    });

    it("throws when set_flair has more than two elements", () => {
        const rules = `
---
set_flair: ['one', 'two', 'three']
        `;

        assert.throws(
            () => parseRules(rules),
            /set_flair.*must NOT have more than 2 items|must NOT have more than 2 items.*set_flair/,
        );
    });

    it("throws when nested set_flair has more than two elements", () => {
        const rules = `
---
author:
  set_flair: ['one', 'two', 'three']
        `;

        assert.throws(
            () => parseRules(rules),
            /set_flair.*must NOT have more than 2 items|must NOT have more than 2 items.*set_flair/,
        );
    });
});
