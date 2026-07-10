/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { SearchMethod, SearchOption, SearchableText } from "../types.js";
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
        it("matches when regex pattern matches", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", makeOptions("regex")),
                ["Hello World"],
            );
        });

        it("does not match when regex pattern does not match", () => {
            assert.equal(
                searchTextMatches("Hello World", "^world", makeOptions("regex")),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", {
                    ...makeOptions("regex"),
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", {
                    ...makeOptions("regex"),
                    negate: true,
                }),
                undefined,
            );
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
