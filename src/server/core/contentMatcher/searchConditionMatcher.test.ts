/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { searchTextMatches } from "./searchConditionMatcher.js";

describe("searchTextMatches", () => {
    describe("default behavior (no options)", () => {
        it("matches when text is included, case-insensitive", () => {
            assert.deepEqual(searchTextMatches("Hello World", "world"), ["world"]);
        });

        it("does not match when text is not included", () => {
            assert.deepEqual(searchTextMatches("Hello World", "planet"), undefined);
        });
    });

    describe("full-exact", () => {
        it("matches exact text with case-insensitive comparison by default", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", { search_method: "full-exact" }),
                ["hello world"],
            );
        });

        it("does not match when content differs", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "Hello", { search_method: "full-exact" }),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", {
                    search_method: "full-exact",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello world", {
                    search_method: "full-exact",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("starts-with", () => {
        it("matches when input starts with text", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello", { search_method: "starts-with" }),
                ["hello"],
            );
        });

        it("does not match when prefix is different", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", { search_method: "starts-with" }),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.equal(
                searchTextMatches("Hello World", "hello", {
                    search_method: "starts-with",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.equal(
                searchTextMatches("Hello World", "hello", {
                    search_method: "starts-with",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("ends-with", () => {
        it("matches when input ends with text", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "world", { search_method: "ends-with" }),
                ["world"],
            );
        });

        it("does not match when suffix is different", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "hello", { search_method: "ends-with" }),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", {
                    search_method: "ends-with",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.equal(
                searchTextMatches("Hello World", "world", {
                    search_method: "ends-with",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("includes-word", () => {
        it("matches whole words", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", { search_method: "includes-word" }),
                ["quick"],
            );
        });

        it("does not match partial words", () => {
            assert.equal(
                searchTextMatches("The quick brown fox", "qui", { search_method: "includes-word" }),
                undefined,
            );
        });

        it("escapes regex metacharacters in search text", () => {
            assert.deepEqual(
                searchTextMatches("Current release is 1.2.3", "1.2.3", { search_method: "includes-word" }),
                ["1.2.3"],
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", {
                    search_method: "includes-word",
                    case_sensitive: true,
                }),
                ["quick"],
            );
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "Quick", {
                    search_method: "includes-word",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("The quick brown fox", "quick", {
                    search_method: "includes-word",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("includes", () => {
        it("matches when text is included", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", { search_method: "includes" }),
                ["lo wo"],
            );
        });

        it("does not match when text is missing", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "abc", { search_method: "includes" }),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", {
                    search_method: "includes",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "lo wo", {
                    search_method: "includes",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    describe("regex", () => {
        it("matches when regex pattern matches", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", { search_method: "regex" }),
                ["Hello World"],
            );
        });

        it("does not match when regex pattern does not match", () => {
            assert.equal(
                searchTextMatches("Hello World", "^world", { search_method: "regex" }),
                undefined,
            );
        });

        it("respects case_sensitive=true", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", {
                    search_method: "regex",
                    case_sensitive: true,
                }),
                undefined,
            );
        });

        it("supports negation", () => {
            assert.deepEqual(
                searchTextMatches("Hello World", "^hello\\s+world$", {
                    search_method: "regex",
                    negate: true,
                }),
                undefined,
            );
        });
    });

    it("throws for an unknown search method", () => {
        assert.throws(
            () => searchTextMatches("Hello World", "Hello", {
                search_method: "not-a-method" as never,
            }),
            /Unknown search method/,
        );
    });
});
