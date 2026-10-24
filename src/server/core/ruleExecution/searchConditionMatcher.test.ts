import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { SearchMethod, SearchOption, SearchableText } from "..";
import { searchConditionsMatchInput, searchTextMatches } from "./searchConditionMatcher.js";

function makeOptions (search_method: SearchMethod, overrides: Partial<Omit<SearchOption, "search_method">> = {}): SearchOption {
    return {
        search_method,
        case_sensitive: false,
        negate: false,
        ...overrides,
    };
}

describe("searchTextMatches", () => {
    describe("default includes behavior", () => {
        it("matches when text is included, case-insensitive", () => {
            assert.deepEqual(searchTextMatches("Hello World", "world", makeOptions("includes")), ["world"]);
        });

        it("does not match when text is not included", () => {
            assert.deepEqual(searchTextMatches("Hello World", "planet", makeOptions("includes")), undefined);
        });
    });

    describe("full-exact", () => {
        it("matches exact text with case-insensitive comparison by default", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", makeOptions("full-exact")),
                ["hello world"],
            );
        });

        it("does not match when content differs", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "Hello", makeOptions("full-exact")),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", {
                    ...makeOptions("full-exact"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", {
                    ...makeOptions("full-exact"),
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("starts-with", () => {
        it("matches when input starts with text", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello", makeOptions("starts-with")),
                ["hello"],
            );
        });

        it("does not match when prefix is different", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", makeOptions("starts-with")),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.equal(
                searchTextMatches("Hello World", "hello", {
                    ...makeOptions("starts-with"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.equal(
                searchTextMatches("Hello World", "hello", {
                    ...makeOptions("starts-with"),
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("ends-with", () => {
        it("matches when input ends with text", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "world", makeOptions("ends-with")),
                ["world"],
            );
        });

        it("does not match when suffix is different", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello", makeOptions("ends-with")),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", {
                    ...makeOptions("ends-with"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", {
                    ...makeOptions("ends-with"),
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("includes-word", () => {
        it("matches whole words", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", makeOptions("includes-word")),
                ["quick"],
            );
        });

        it("matches whole words with punctuation", () => {
            assert.deepEqual(
                searchTextMatches("You've broken a rule.\n\n!lock", "!lock", makeOptions("includes-word")),
                ["!lock"],
            );
        });

        it("does not match partial words", () => {
            assert.equal(
                searchTextMatches("The quick brown fox", "qui", makeOptions("includes-word")),
                undefined,
            );
        });

        it("escapes regex metacharacters in search text", () => {
            assert.deepEqual(
                searchTextMatches("Current release is 1.2.3", "1.2.3", makeOptions("includes-word")),
                ["1.2.3"],
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", {
                    ...makeOptions("includes-word"),
                    case_sensitive: true,
                }),
                ["quick"],
            );
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "Quick", {
                    ...makeOptions("includes-word"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", {
                    ...makeOptions("includes-word"),
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("includes", () => {
        it("matches when text is included", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", makeOptions("includes")),
                ["lo wo"],
            );
        });

        it("does not match when text is missing", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "abc", makeOptions("includes")),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", {
                    ...makeOptions("includes"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", {
                    ...makeOptions("includes"),
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("regex", () => {
        describe("includes (default)", () => {
            it("matches when regex pattern matches", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "^hello\\s+world$", makeOptions("includes", { regex: true })),
                    ["Hello World"],
                );
            });

            it("does not match when regex pattern does not match", () => {
                assert.equal(
                    searchTextMatches("Hello World", "^world", makeOptions("includes", { regex: true })),
                    undefined,
                );
            });

            it("respects case_sensitive=true", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "^hello\\s+world$", {
                        ...makeOptions("includes", { regex: true }),
                        case_sensitive: true,
                    }),
                    undefined,
                );
            });

            it("supports negation", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "^hello\\s+world$", {
                        ...makeOptions("includes", { regex: true }),
                        negate: true,
                    }),
                    undefined,
                );
            });
        });

        describe("includes-word", () => {
            it("matches when the pattern is a whole word", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "hello", makeOptions("includes-word", { regex: true })),
                    ["hello"],
                );
            });

            it("does not match when the pattern is a substring of a word", () => {
                assert.equal(
                    searchTextMatches("helloworld", "hello", makeOptions("includes-word", { regex: true })),
                    undefined,
                );
            });

            it("handles alternation correctly with word boundaries", () => {
                assert.deepEqual(
                    searchTextMatches("has foo and bar", "foo|bar", makeOptions("includes-word", { regex: true })),
                    ["foo|bar"],
                );
            });

            it("does not match alternation when no alternative is a standalone word", () => {
                assert.equal(
                    searchTextMatches("foobar", "foo|bar", makeOptions("includes-word", { regex: true })),
                    undefined,
                );
            });
        });

        describe("starts-with", () => {
            it("matches when the input starts with the pattern", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "hello", makeOptions("starts-with", { regex: true })),
                    ["Hello"],
                );
            });

            it("does not match when the input does not start with the pattern", () => {
                assert.equal(
                    searchTextMatches("Hello World", "world", makeOptions("starts-with", { regex: true })),
                    undefined,
                );
            });

            it("handles alternation correctly — only matches at the start", () => {
                assert.deepEqual(
                    searchTextMatches("World Hello", "hello|world", makeOptions("starts-with", { regex: true })),
                    ["World"],
                );
                assert.equal(
                    searchTextMatches("ends with hello", "hello|world", makeOptions("starts-with", { regex: true })),
                    undefined,
                );
            });
        });

        describe("ends-with", () => {
            it("matches when the input ends with the pattern", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "world", makeOptions("ends-with", { regex: true })),
                    ["World"],
                );
            });

            it("does not match when the input does not end with the pattern", () => {
                assert.equal(
                    searchTextMatches("Hello World", "hello", makeOptions("ends-with", { regex: true })),
                    undefined,
                );
            });

            it("handles alternation correctly — only matches at the end", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "hello|world", makeOptions("ends-with", { regex: true })),
                    ["World"],
                );
                assert.equal(
                    searchTextMatches("hello starts here", "hello|world", makeOptions("ends-with", { regex: true })),
                    undefined,
                );
            });
        });

        describe("full-exact", () => {
            it("matches when the pattern matches the full input", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "hello\\s+world", makeOptions("full-exact", { regex: true })),
                    ["Hello World"],
                );
            });

            it("does not match when the input has extra content", () => {
                assert.equal(
                    searchTextMatches("Hello World and more", "hello\\s+world", makeOptions("full-exact", { regex: true })),
                    undefined,
                );
            });

            it("handles alternation correctly — must match the full string", () => {
                assert.deepEqual(
                    searchTextMatches("Hello", "hello|world", makeOptions("full-exact", { regex: true })),
                    ["Hello"],
                );
                assert.equal(
                    searchTextMatches("Say Hello", "hello|world", makeOptions("full-exact", { regex: true })),
                    undefined,
                );
            });
        });

        describe("full-text", () => {
            it("matches when the pattern matches the full input", () => {
                assert.deepEqual(
                    searchTextMatches("Hello World", "hello\\s+world", makeOptions("full-text", { regex: true })),
                    ["Hello World"],
                );
            });

            it("strips leading and trailing punctuation from the input before matching", () => {
                assert.deepEqual(
                    searchTextMatches("  Hello World!  ", "hello\\s+world", makeOptions("full-text", { regex: true })),
                    ["Hello World"],
                );
            });

            it("does not match when the input has extra non-punctuation content", () => {
                assert.equal(
                    searchTextMatches("Hello World and more", "hello\\s+world", makeOptions("full-text", { regex: true })),
                    undefined,
                );
            });
        });

        describe("domain", () => {
            it("matches when the regex matches the domain string", () => {
                assert.deepEqual(
                    searchTextMatches("reddit.com", "reddit\\.(?:com|net)", makeOptions("domain", { regex: true })),
                    ["reddit.com"],
                );
            });

            it("does not match when the regex does not match", () => {
                assert.equal(
                    searchTextMatches("digg.com", "reddit\\.(?:com|net)", makeOptions("domain", { regex: true })),
                    undefined,
                );
            });
        });
    });

    it("throws for an unknown search method", () => {
        assert.throws(
            () => searchTextMatches("Hello World", "Hello", {
                ...makeOptions("includes"),
                search_method: "not-a-method" as never,
            }),
            /Unknown search method/,
        );
    });
});

describe("searchConditionsMatchInput", () => {
    it("requires all conditions to match when there is more than one condition entry", () => {
        const conditions: SearchableText[] = [
            {
                searchField: ["title"],
                text: ["hello"],
                options: { search_method: "includes", case_sensitive: false, negate: false },
            },
            {
                searchField: ["body"],
                text: ["world"],
                options: { search_method: "includes", case_sensitive: false, negate: false },
            },
        ];

        const matchingInput = {
            title: "Hello there",
            body: "Planet world news",
        };
        assert.deepEqual(searchConditionsMatchInput(matchingInput, conditions), [
            { category: "title", matches: ["hello"] },
            { category: "body", matches: ["world"] },
        ]);

        const missingOneConditionInput = {
            title: "Hello there",
            body: "No related content",
        };
        assert.equal(searchConditionsMatchInput(missingOneConditionInput, conditions), undefined);
    });

    it("allows any field in a condition to satisfy that condition", () => {
        const conditions: SearchableText[] = [
            {
                searchField: ["title", "body"],
                text: ["urgent"],
                options: { search_method: "includes", case_sensitive: false, negate: false },
            },
        ];

        const inputMatchedBySecondField = {
            title: "Routine update",
            body: "This is urgent and needs attention",
        };

        assert.deepEqual(searchConditionsMatchInput(inputMatchedBySecondField, conditions), [
            { category: "body", matches: ["urgent"] },
        ]);
    });
});

describe("searchTextMatches (full-text)", () => {
    it("matches when leading/trailing punctuation and whitespace in textToMatch are ignored", () => {
        assert.deepEqual(
            searchTextMatches("Hello World", "  !!Hello World??  ", makeOptions("full-text")),
            ["  !!Hello World??  "],
        );
    });

    it("does not ignore internal punctuation", () => {
        assert.deepEqual(
            searchTextMatches("Hello World", "Hello, World", makeOptions("full-text")),
            undefined,
        );
    });

    it("is case-insensitive by default", () => {
        assert.deepEqual(
            searchTextMatches("hello world", "  --HeLLo WoRLD--  ", makeOptions("full-text")),
            ["  --HeLLo WoRLD--  "],
        );
    });

    it("respects case_sensitive=true", () => {
        assert.deepEqual(
            searchTextMatches("hello world", "  --HeLLo WoRLD--  ", {
                ...makeOptions("full-text"),
                case_sensitive: true,
            }),
            undefined,
        );
    });

    it("does not trim or strip punctuation from input", () => {
        assert.deepEqual(
            searchTextMatches("  Hello World  ", "Hello World", makeOptions("full-text")),
            undefined,
        );
    });

    it("supports negation when a positive full-text match exists", () => {
        assert.deepEqual(
            searchTextMatches("Hello World", "!!Hello World!!", {
                ...makeOptions("full-text"),
                negate: true,
            }),
            undefined,
        );
    });

    it("supports negation when a positive full-text match does not exist", () => {
        assert.deepEqual(
            searchTextMatches("Hello World", "!!Different Text!!", {
                ...makeOptions("full-text"),
                negate: true,
            }),
            [],
        );
    });

    it("matches empty input when textToMatch normalizes to empty", () => {
        assert.deepEqual(
            searchTextMatches("", "   !!!   ", makeOptions("full-text")),
            ["   !!!   "],
        );
    });
});

describe("negated search conditions", () => {
    it("requires every configured text option to be absent", () => {
        const conditions: SearchableText[] = [{
            searchField: ["body"],
            text: ["dog", "cat"],
            options: { search_method: "includes", case_sensitive: false, negate: true },
        }];

        assert.equal(searchConditionsMatchInput({ body: "A dog is here" }, conditions), undefined);
        assert.deepEqual(searchConditionsMatchInput({ body: "A bird is here" }, conditions), []);
    });

    it("requires prohibited text to be absent from every selected field", () => {
        const conditions: SearchableText[] = [{
            searchField: ["title", "body"],
            text: ["urgent"],
            options: { search_method: "includes", case_sensitive: false, negate: true },
        }];

        assert.equal(searchConditionsMatchInput({
            title: "Routine update",
            body: "This is urgent",
        }, conditions), undefined);
        assert.deepEqual(searchConditionsMatchInput({
            title: "Routine update",
            body: "Nothing unusual",
        }, conditions), []);
    });

    it("requires prohibited text to be absent from every array value", () => {
        const conditions: SearchableText[] = [{
            searchField: ["social_links"],
            text: ["example.com"],
            options: { search_method: "includes", case_sensitive: false, negate: true },
        }];

        assert.equal(searchConditionsMatchInput({
            social_links: ["https://safe.example", "https://example.com/profile"],
        }, conditions), undefined);
        assert.deepEqual(searchConditionsMatchInput({
            social_links: ["https://safe.example", "https://another.example"],
        }, conditions), []);
    });
});
