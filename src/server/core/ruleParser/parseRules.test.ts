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
body#check+2: hyena
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
                    {
                        searchField: ["body"],
                        text: ["hyena"],
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

    it("parses qualifier keys with optional and repeated whitespace before parentheses", () => {
        const rules = `
---
title+body(regex): '^foo'
url   (includes): 'example.com/path'
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["title", "body"],
                        text: ["^foo"],
                        options: {
                            search_method: "regex",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["url"],
                        text: ["example.com/path"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
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

    it("normalizes author shorthand values to name search conditions at any level", () => {
        const rules = `
---
author: ['user1', 'user2']
crosspost_author: 'user3'
parent_submission:
  author: 'user4'
  crosspost_author: ['user5', 'user6']
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["user1", "user2"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                crosspost_author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["user3"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                parent_submission: {
                    author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["user4"],
                                options: {
                                    search_method: "includes-word",
                                    case_sensitive: false,
                                    negate: false,
                                },
                            },
                        ],
                    },
                    crosspost_author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["user5", "user6"],
                                options: {
                                    search_method: "includes-word",
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

    it("normalizes negated author shorthand values to negated name search conditions at any level", () => {
        const rules = `
---
~author: ['AutoModerator', 'RuleBot']
~crosspost_author: 'CrosspostBot'
parent_submission:
  ~author: 'ParentAutoMod'
  ~crosspost_author: ['ParentCrosspostBotA', 'ParentCrosspostBotB']
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["AutoModerator", "RuleBot"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: true,
                            },
                        },
                    ],
                },
                crosspost_author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["CrosspostBot"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: true,
                            },
                        },
                    ],
                },
                parent_submission: {
                    author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["ParentAutoMod"],
                                options: {
                                    search_method: "includes-word",
                                    case_sensitive: false,
                                    negate: true,
                                },
                            },
                        ],
                    },
                    crosspost_author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["ParentCrosspostBotA", "ParentCrosspostBotB"],
                                options: {
                                    search_method: "includes-word",
                                    case_sensitive: false,
                                    negate: true,
                                },
                            },
                        ],
                    },
                },
            },
        ]);
    });

    it("normalizes mixed-case attributes to lowercase at all levels", () => {
        const rules = `
---
Comment: 'Add a comment'
Type: comment
AUTHOR:
  Name (Includes): ['UserA']
SubReddit:
  Name: 'MySub'
PARENT_SUBMISSION:
  TITLE (Regex): '^Hello'
  AUTHOR:
    NAME: 'ParentUser'
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                comment: "Add a comment",
                type: "comment",
                author: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["UserA"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                subreddit: {
                    search_conditions: [
                        {
                            searchField: ["name"],
                            text: ["MySub"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                },
                parent_submission: {
                    search_conditions: [
                        {
                            searchField: ["title"],
                            text: ["^Hello"],
                            options: {
                                search_method: "regex",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                    ],
                    author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["ParentUser"],
                                options: {
                                    search_method: "includes-word",
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

    it("normalizes media searchable fields", () => {
        const rules = `
---
media_author (regex): '^author_[0-9]+$'
media_author_url (includes): 'example.com/channel'
media_title: ['first title', 'second title']
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
                ],
            },
        ]);
    });

    it("accepts parent_submission action fields", () => {
        const rules = `
---
type: comment
author:
  is_moderator: true
moderators_exempt: false
is_top_level: true
is_edited: False
body (starts-with):
  - "!rule"
action: remove
parent_submission:
  action: remove
  set_locked: true
  action_reason: "AutoMod 027 - Bot Removal: {{body}} by {{author}}"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                author: {
                    is_moderator: true,
                },
                moderators_exempt: false,
                is_top_level: true,
                is_edited: false,
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["!rule"],
                        options: {
                            search_method: "starts-with",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                action: "remove",
                parent_submission: {
                    action: "remove",
                    set_locked: true,
                    action_reason: "AutoMod 027 - Bot Removal: {{body}} by {{author}}",
                },
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

    it("normalizes set_flair dictionary alias keys", () => {
        const rules = `
---
set_flair:
  text: 'flair text'
  template id: '2b09deac-9403-11ed-993a-a2db1fe5dec7'
author:
  set_flair:
    template id: '2b09deac-9403-11ed-993a-a2db1fe5dec8'
    css class: helper
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                set_flair: {
                    text: "flair text",
                    template_id: "2b09deac-9403-11ed-993a-a2db1fe5dec7",
                },
                author: {
                    set_flair: {
                        template_id: "2b09deac-9403-11ed-993a-a2db1fe5dec8",
                        css_class: "helper",
                    },
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

    it("preserves poll_option_count when provided as a number", () => {
        const rules = `
---
poll_option_count: 3
body: "poll"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                poll_option_count: "3",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["poll"],
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

    it("preserves poll_option_count when provided as a greater-than expression", () => {
        const rules = `
---
poll_option_count: "> 3"
body: "poll"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                poll_option_count: "> 3",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["poll"],
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

    it("preserves poll_option_count when provided as a less-than expression", () => {
        const rules = `
---
poll_option_count: "< 4"
body: "poll"
        `;

        const parsed = parseRules(rules);

        assert.deepEqual(parsed, [
            {
                poll_option_count: "< 4",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["poll"],
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
