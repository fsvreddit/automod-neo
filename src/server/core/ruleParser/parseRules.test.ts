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
                search_conditions: [
                    {
                        searchField: ["title"],
                        text: [
                            "Hello World",
                        ],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["body"],
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
                search_conditions: [
                    {
                        searchField: ["title"],
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

    it("normalizes searchable fields with joins, qualifiers, and numbered keys", () => {
        const rules = `
---
id: abcde
id#primary: fghij
title+body+url (includes, case_sensitive): "abcde"
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
    body+title+url (regex): ['regex1', 'regex2']
    crosspost_title#1: one
    crosspost_title#2: two
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["id"],
                        text: ["abcde"],
                        options: {
                            search_method: "full-exact",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["id"],
                        text: ["fghij"],
                        options: {
                            search_method: "full-exact",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["title", "body", "url"],
                        text: ["abcde"],
                        options: {
                            search_method: "includes",
                            case_sensitive: true,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["dog"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: true,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["attack"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: true,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["wolf"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["^foo.*"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["display_name"],
                            text: ["DisplayName"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["bio_text"],
                            text: ["^bio_.*$"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["social_links"],
                            text: ["example.com/a"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["social_links"],
                            text: ["example.com/b"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                parent_submission: {
                    search_conditions: [
                        {
                            searchField: ["body", "title", "url"],
                            text: ["regex1", "regex2"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["crosspost_title"],
                            text: ["one"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["crosspost_title"],
                            text: ["two"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
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
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["alpha"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["beta"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                author: {
                    search_conditions: [
                        {
                            searchField: ["social_links"],
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
                search_conditions: [
                    {
                        searchField: ["id"],
                        text: ["abcde", "defgh"],
                        options: {
                            search_method: "full-exact",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["first", "second"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
            },
        ]);
    });

    it("normalizes media searchable fields", () => {
        const rules = `
---
media_author (regex): '^author_[0-9]+$'
media_author_url (includes): 'example.com/channel'
media_title: ['first title', 'second title']
media_description#summary: 'long description'
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["media_author"],
                        text: ["^author_[0-9]+$"],
                        options: {
                            search_method: "regex",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["media_author_url"],
                        text: ["example.com/channel"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["media_title"],
                        text: ["first title", "second title"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["media_description"],
                        text: ["long description"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
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
            /Rule 1: Invalid regex pattern for attribute 'body \(regex\)'/,
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
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["^user_[0-9]+$"],
                                options: {
                                    search_method: "regex",
                                    case_sensitive: false,
                                    negate: false,
                                },
                            },
                            {
                                searchField: ["bio_text"],
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
            /Rule 1: Invalid regex pattern for attribute 'bio_text \(regex\)' in author/,
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
            /Rule 1: Attribute 'set_flair' must have at most 2 items\./,
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
            /Rule 1: Attribute 'author\.set_flair' must have at most 2 items\./,
        );
    });

    it("reports unsupported searchable attributes using the raw input key", () => {
        const rules = `
---
suject+body: "typo"
        `;

        assert.throws(
            () => parseRules(rules),
            /Rule 1: Unsupported attribute 'suject\+body'\./,
        );
    });

    it("uses friendly_name in unsupported attribute errors", () => {
        const rules = `
---
friendly_name: "Typo Rule"
author:
  nmae: "typo"
        `;

        assert.throws(
            () => parseRules(rules),
            /Rule 'Typo Rule': Unsupported attribute 'nmae' in author\./,
        );
    });

    it("uses friendly_name in regex validation errors", () => {
        const rules = `
---
friendly_name: "Regex Rule"
body (regex): '['
        `;

        assert.throws(
            () => parseRules(rules),
            /Rule 'Regex Rule': Invalid regex pattern for attribute 'body \(regex\)'/,
        );
    });

    it("normalizes id as searchable field for author and parent_submission", () => {
        const rules = `
---
author:
  id: user_123
parent_submission:
  id#1: abcde
  id#2: fghij
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                author: {
                    search_conditions: [
                        {
                            searchField: ["id"],
                            text: ["user_123"],
                            options: {
                                search_method: "full-exact",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                parent_submission: {
                    search_conditions: [
                        {
                            searchField: ["id"],
                            text: ["abcde"],
                            options: {
                                search_method: "full-exact",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["id"],
                            text: ["fghij"],
                            options: {
                                search_method: "full-exact",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
            },
        ]);
    });

    it("preserves discord_alert when provided", () => {
        const rules = `
---
discord_alert: "Ping moderators in Discord"
body: "urgent"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                discord_alert: "Ping moderators in Discord",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["urgent"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
            },
        ]);
    });

    it("preserves friendly_name when provided", () => {
        const rules = `
---
friendly_name: "Urgent Body Rule"
body: "urgent"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                friendly_name: "Urgent Body Rule",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["urgent"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
            },
        ]);
    });

    it("preserves verbose_logs when provided", () => {
        const rules = `
---
verbose_logs: true
body: "log this"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                verbose_logs: true,
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["log this"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
            },
        ]);
    });
});
