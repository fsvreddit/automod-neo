import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { parseRules } from "./parseRules";

describe("parseRules", () => {
    it("parses a simple rule correctly", async () => {
        const rules = `
---
title (includes): "Hello World"
body (regex): "foo\\d{1,3}bar"
        `;

        const parsed = await parseRules(rules);

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
                            "foo\\d{1,3}bar",
                        ],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                            regex: true,
                        },
                    },
                ],
            },
        ]);
    });

    it("parses rules with negation correctly", async () => {
        const rules = `
---
~title: text
        `;

        const parsed = await parseRules(rules);

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

    it("normalizes searchable fields with joins, qualifiers, and numbered keys", async () => {
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
    social_link_title: 'Onlyfans'
parent_submission:
    body+title+url (regex): ['regex1', 'regex2']
    crosspost_title#1: one
    crosspost_title#2: two
        `;

        const parsed = await parseRules(rules);

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
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                                regex: true,
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
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                                regex: true,
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
                        {
                            searchField: ["social_link_title"],
                            text: ["Onlyfans"],
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
                            searchField: ["body", "title", "url"],
                            text: ["regex1", "regex2"],
                            options: {
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                                regex: true,
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

    it("parses qualifier keys with optional and repeated whitespace before parentheses", async () => {
        const rules = `
---
title+body(regex): '^foo'
url   (includes): 'example.com/path'
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["title", "body"],
                        text: ["^foo"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                            regex: true,
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

    it("parses searchable field with a single explicit search method", async () => {
        const rules = `
---
body (includes): "hello"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["hello"],
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

    it("parses body (includes, regex) as includes search method with regex flag", async () => {
        const rules = `
---
body (includes, regex): "hello"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["hello"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                            regex: true,
                        },
                    },
                ],
            },
        ]);
    });

    it("parses body (full-exact, regex) as includes search method with regex flag", async () => {
        const rules = `
---
body (full-exact, regex): "hello"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["hello"],
                        options: {
                            search_method: "full-exact",
                            case_sensitive: false,
                            negate: false,
                            regex: true,
                        },
                    },
                ],
            },
        ]);
    });

    it("throws when more than one non-regex search method is specified for a searchable field", async () => {
        const rules = `
---
body (includes, starts-with): "hello"
        `;

        await assert.rejects(
            parseRules(rules),
            /Multiple search methods are not allowed for attribute 'body \(includes, starts-with\)'/,
        );
    });

    it("normalizes searchable fields with named key suffixes", async () => {
        const rules = `
---
body#redact: alpha
body#review: beta
author:
  social_links#twitter (includes): x.com/example
        `;

        const parsed = await parseRules(rules);

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

    it("coerces id and searchable text string arrays", async () => {
        const rules = `
---
id: ['abcde', 'defgh']
body: ['first', 'second']
        `;

        const parsed = await parseRules(rules);

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

    it("normalizes author shorthand values to name search conditions at any level", async () => {
        const rules = `
---
author: ['user1', 'user2']
crosspost_author: 'user3'
parent_submission:
  author: 'user4'
  crosspost_author: ['user5', 'user6']
        `;

        const parsed = await parseRules(rules);

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

    it("normalizes negated author shorthand values to negated name search conditions at any level", async () => {
        const rules = `
---
~author: ['AutoModerator', 'RuleBot']
~crosspost_author: 'CrosspostBot'
parent_submission:
  ~author: 'ParentAutoMod'
  ~crosspost_author: ['ParentCrosspostBotA', 'ParentCrosspostBotB']
        `;

        const parsed = await parseRules(rules);

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

    it("normalizes mixed-case attributes to lowercase at all levels", async () => {
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

        const parsed = await parseRules(rules);

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
                                search_method: "includes",
                                case_sensitive: false,
                                negate: false,
                                regex: true,
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

    it("normalizes media searchable fields", async () => {
        const rules = `
---
media_author (regex): '^author_[0-9]+$'
media_author_url (includes): 'example.com/channel'
media_title: ['first title', 'second title']
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                search_conditions: [
                    {
                        searchField: ["media_author"],
                        text: ["^author_[0-9]+$"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                            regex: true,
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

    it("accepts parent_submission action fields", async () => {
        const rules = `
---
type: comment
author:
  is_moderator: true
  is_banned: false
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

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                author: {
                    is_moderator: true,
                    is_banned: false,
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

    it("throws when a regex searchable text contains an invalid regular expression", async () => {
        const rules = `
---
body (regex): '['
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid regex pattern for attribute 'body \(regex\)'/,
        );
    });

    it("validates regex patterns in nested searchable nodes", async () => {
        const rules = `
---
parent_submission:
  author:
        name (regex): '^user_[0-9]+$'
        bio_text (regex): '^bio_[a-z]+$'
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                parent_submission: {
                    author: {
                        search_conditions: [
                            {
                                searchField: ["name"],
                                text: ["^user_[0-9]+$"],
                                options: {
                                    search_method: "includes",
                                    case_sensitive: false,
                                    negate: false,
                                    regex: true,
                                },
                            },
                            {
                                searchField: ["bio_text"],
                                text: ["^bio_[a-z]+$"],
                                options: {
                                    search_method: "includes",
                                    case_sensitive: false,
                                    negate: false,
                                    regex: true,
                                },
                            },
                        ],
                    },
                },
            },
        ]);
    });

    it("throws when a new author searchable field contains an invalid regex", async () => {
        const rules = `
---
author:
  bio_text (regex): '('
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid regex pattern for attribute 'bio_text \(regex\)' in author/,
        );
    });

    it("accepts set_flair arrays with at most two elements", async () => {
        const rules = `
---
set_flair: ['one', 'two']
author:
  set_flair: ['left', 'right']
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                set_flair: ["one", "two"],
                author: {
                    set_flair: ["left", "right"],
                },
            },
        ]);
    });

    it("normalizes set_flair dictionary alias keys", async () => {
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

        const parsed = await parseRules(rules);

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

    it("throws when set_flair has more than two elements", async () => {
        const rules = `
---
set_flair: ['one', 'two', 'three']
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Attribute 'set_flair' must have at most 2 items\./,
        );
    });

    it("throws when nested set_flair has more than two elements", async () => {
        const rules = `
---
author:
  set_flair: ['one', 'two', 'three']
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Attribute 'author\.set_flair' must have at most 2 items\./,
        );
    });

    it("reports unsupported searchable attributes using the raw input key", async () => {
        const rules = `
---
suject+body: "typo"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Unsupported attribute 'suject\+body'\./,
        );
    });

    it("uses friendly_name in unsupported attribute errors", async () => {
        const rules = `
---
friendly_name: "Typo Rule"
author:
  nmae: "typo"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 'Typo Rule': Unsupported attribute 'nmae' in author\./,
        );
    });

    it("uses friendly_name in regex validation errors", async () => {
        const rules = `
---
friendly_name: "Regex Rule"
body (regex): '['
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 'Regex Rule': Invalid regex pattern for attribute 'body \(regex\)'/,
        );
    });

    it("normalizes id as searchable field for author and parent_submission", async () => {
        const rules = `
---
author:
  id: user_123
parent_submission:
  id#1: abcde
  id#2: fghij
        `;

        const parsed = await parseRules(rules);

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

    it("preserves discord_alert when provided", async () => {
        const rules = `
---
discord_alert: "Ping moderators in Discord"
body: "urgent"
        `;

        const parsed = await parseRules(rules);

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

    it("preserves friendly_name when provided", async () => {
        const rules = `
---
friendly_name: "Urgent Body Rule"
body: "urgent"
        `;

        const parsed = await parseRules(rules);

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

    it("preserves verbose_logs when provided", async () => {
        const rules = `
---
verbose_logs: true
body: "log this"
        `;

        const parsed = await parseRules(rules);

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

    it("passes through ~day_of_week when provided as a single value", async () => {
        const rules = `
---
~day_of_week: WeekDay
body: "quiet hours"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                "~day_of_week": ["weekday"],
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["quiet hours"],
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

    it("passes through ~day_of_week when provided as an array", async () => {
        const rules = `
---
~day_of_week: [Saturday, SuNday]
body: "weekend only"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                "~day_of_week": ["saturday", "sunday"],
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["weekend only"],
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

    it("preserves age and comment_count on submission rules", async () => {
        const rules = `
---
type: submission
age: "> 2 weeks"
comment_count: "> 10"
body: "engagement check"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "submission",
                age: "> 2 weeks",
                comment_count: "> 10",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["engagement check"],
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

    it("preserves parent_submission age and comment_count on comment rules", async () => {
        const rules = `
---
type: comment
body: "parent check"
parent_submission:
  age: "< 30 days"
  comment_count: "<= 200"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["parent check"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_submission: {
                    age: "< 30 days",
                    comment_count: "<= 200",
                },
            },
        ]);
    });

    it("preserves paragraph_count on submission rules", async () => {
        const rules = `
---
type: submission
paragraph_count: ">= 3"
body: "paragraph check"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "submission",
                paragraph_count: ">= 3",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["paragraph check"],
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

    it("preserves parent_submission paragraph_count on comment rules", async () => {
        const rules = `
---
type: comment
body: "parent paragraph check"
parent_submission:
  paragraph_count: "< 8"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["parent paragraph check"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_submission: {
                    paragraph_count: "< 8",
                },
            },
        ]);
    });

    it("throws when age has an invalid format on submission rules", async () => {
        const rules = `
---
type: submission
age: "sometime soon"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid date threshold format for attribute 'age'/,
        );
    });

    it("throws when comment_count has an invalid format on submission rules", async () => {
        const rules = `
---
type: submission
comment_count: "ten"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid numeric threshold format for attribute 'comment_count'/,
        );
    });

    it("throws when parent_submission.age has an invalid format on comment rules", async () => {
        const rules = `
---
type: comment
parent_submission:
  age: "yesterdayish"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid date threshold format for attribute 'age'/,
        );
    });

    it("throws when parent_submission.comment_count has an invalid format on comment rules", async () => {
        const rules = `
---
type: comment
parent_submission:
  comment_count: "many"
        `;

        await assert.rejects(
            parseRules(rules),
            /Rule 1: Invalid numeric threshold format for attribute 'comment_count'/,
        );
    });

    it("preserves poll_option_count when provided as a number", async () => {
        const rules = `
---
poll_option_count: 3
body: "poll"
        `;

        const parsed = await parseRules(rules);

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

    it("preserves poll_option_count when provided as a greater-than expression", async () => {
        const rules = `
---
poll_option_count: "> 3"
body: "poll"
        `;

        const parsed = await parseRules(rules);

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

    it("preserves poll_option_count when provided as a less-than expression", async () => {
        const rules = `
---
poll_option_count: "< 4"
body: "poll"
        `;

        const parsed = await parseRules(rules);

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

    it("preserves image_count on submission rules", async () => {
        const rules = `
---
type: submission
image_count: "> 2"
body: "gallery check"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "submission",
                image_count: "> 2",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["gallery check"],
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

    it("parses user_report_reason and mod_report_reason as searchable fields", async () => {
        const rules = `
---
type: comment
user_report_reason: ['spam', 'abuse']
mod_report_reason (includes): 'queue review'
body: "reported"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["user_report_reason"],
                        text: ["spam", "abuse"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["mod_report_reason"],
                        text: ["queue review"],
                        options: {
                            search_method: "includes",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                    {
                        searchField: ["body"],
                        text: ["reported"],
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

    it("parses parent_submission report-reason checks as searchable fields", async () => {
        const rules = `
---
type: comment
body: "child"
parent_submission:
  user_report_reason: 'user reason'
  mod_report_reason: 'mod reason'
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["child"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_submission: {
                    search_conditions: [
                        {
                            searchField: ["user_report_reason"],
                            text: ["user reason"],
                            options: {
                                search_method: "includes-word",
                                case_sensitive: false,
                                negate: false,
                            },
                        },
                        {
                            searchField: ["mod_report_reason"],
                            text: ["mod reason"],
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

    it("preserves is_approved for post conditions when provided", async () => {
        const rules = `
---
is_approved: true
body: "approved post"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                is_approved: true,
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["approved post"],
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

    it("preserves is_nsfw for post conditions when provided", async () => {
        const rules = `
---
type: submission
is_nsfw: true
body: "nsfw post"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "submission",
                is_nsfw: true,
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["nsfw post"],
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

    it("preserves is_approved for comment conditions when provided", async () => {
        const rules = `
---
type: comment
is_approved: false
body: "unapproved comment"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                is_approved: false,
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["unapproved comment"],
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

    it("preserves is_approved for parent_submission conditions when provided", async () => {
        const rules = `
---
type: comment
parent_submission:
  is_approved: true
  body: "approved parent"
body: "child comment"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["child comment"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_submission: {
                    is_approved: true,
                    search_conditions: [
                        {
                            searchField: ["body"],
                            text: ["approved parent"],
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

    it("preserves is_nsfw for parent_submission conditions when provided", async () => {
        const rules = `
---
type: comment
parent_submission:
  is_nsfw: true
  body: "nsfw parent"
body: "child comment"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["child comment"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_submission: {
                    is_nsfw: true,
                    search_conditions: [
                        {
                            searchField: ["body"],
                            text: ["nsfw parent"],
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

    it("preserves parent_comment conditions when provided", async () => {
        const rules = `
---
type: comment
parent_comment:
  is_approved: false
  body: "unapproved parent"
body: "child comment"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                type: "comment",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["child comment"],
                        options: {
                            search_method: "includes-word",
                            case_sensitive: false,
                            negate: false,
                        },
                    },
                ],
                parent_comment: {
                    is_approved: false,
                    search_conditions: [
                        {
                            searchField: ["body"],
                            text: ["unapproved parent"],
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

    it("accepts a valid Discord webhook URL when discord_alert is also present", async () => {
        const rules = `
---
alert_webhook: "https://discord.com/api/webhooks/123456/abc_DEF-789"
discord_alert: "Alert message"
body: "trigger"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                alert_webhook: "https://discord.com/api/webhooks/123456/abc_DEF-789",
                discord_alert: "Alert message",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["trigger"],
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

    it("accepts a valid Slack webhook URL when discord_alert is also present", async () => {
        const rules = `
---
alert_webhook: "https://hooks.slack.com/services/T01234567/B01234567/abc_DEF-789"
discord_alert: "Alert message"
body: "trigger"
        `;

        const parsed = await parseRules(rules);

        assert.deepEqual(parsed, [
            {
                alert_webhook: "https://hooks.slack.com/services/T01234567/B01234567/abc_DEF-789",
                discord_alert: "Alert message",
                search_conditions: [
                    {
                        searchField: ["body"],
                        text: ["trigger"],
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

    it("throws when alert_webhook is not a string", async () => {
        const rules = `
---
alert_webhook: 12345
discord_alert: "Alert message"
        `;

        await assert.rejects(
            parseRules(rules),
            /Invalid alert_webhook in rule Rule 1/,
        );
    });

    it("throws when alert_webhook is not a valid URL", async () => {
        const rules = `
---
alert_webhook: "not-a-valid-url"
discord_alert: "Alert message"
        `;

        await assert.rejects(
            parseRules(rules),
            /Invalid alert_webhook URL in rule Rule 1/,
        );
    });

    it("throws when alert_webhook URL is not a recognised Discord or Slack webhook", async () => {
        const rules = `
---
alert_webhook: "https://example.com/webhooks/123456/abc_DEF-789"
discord_alert: "Alert message"
        `;

        await assert.rejects(
            parseRules(rules),
            /Invalid alert_webhook URL in rule Rule 1/,
        );
    });

    it("throws when alert_webhook is present without discord_alert", async () => {
        const rules = `
---
alert_webhook: "https://discord.com/api/webhooks/123456/abc_DEF-789"
        `;

        await assert.rejects(
            parseRules(rules),
            /alert_webhook is specified but discord_alert is missing in rule Rule 1/,
        );
    });

    it("uses friendly_name in alert_webhook validation errors", async () => {
        const rules = `
---
friendly_name: "My Alert Rule"
alert_webhook: "https://discord.com/api/webhooks/123456/abc_DEF-789"
        `;

        await assert.rejects(
            parseRules(rules),
            /alert_webhook is specified but discord_alert is missing in rule Rule 'My Alert Rule'/,
        );
    });
});
