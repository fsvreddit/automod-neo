import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    context: {},
    reddit: {},
}));

vi.mock("@devvit/web/shared", () => ({
    isT1: () => false,
}));

vi.mock("@fsvreddit/fsv-devvit-web-helpers", () => ({
    getPostOrCommentById: vi.fn(),
}));

vi.mock("../helpers", () => ({
    getBotCommentFooter: () => "",
    getDomainFromUrl: (url: string) => {
        try {
            return new URL(url).hostname;
        } catch {
            return undefined;
        }
    },
}));

import { valueWithPlaceholdersReplaced } from "./actionRules";
import { AutomodRule, Matches } from "../types";

const baseTarget = {
    authorName: "example_author",
    body: "line one\nline two",
    permalink: "/r/test/comments/abc123/example",
    subredditName: "test",
    url: "https://example.com/path",
};

const blankRule: AutomodRule = {};

describe("valueWithPlaceholdersReplaced", () => {
    it("returns undefined when input is undefined", () => {
        const result = valueWithPlaceholdersReplaced(undefined, baseTarget, { rule: blankRule, matches: [] });

        assert.equal(result, undefined);
    });

    it("replaces standard placeholders", () => {
        const matches: Matches[] = [{
            category: "title",
            matches: ["first_match"],
        }];

        const result = valueWithPlaceholdersReplaced(
            "Author={{author}} | Body={{body}} | Link={{permalink}} | Kind={{kind}} | Domain={{domain}} | Url={{url}} | Match={{match}}",
            {
                ...baseTarget,
                title: "My title",
            },
            { rule: blankRule, matches },
        );

        assert.equal(
            result,
            "Author=example\\_author | Body=line one\nline two | Link=https://www.reddit.com/r/test/comments/abc123/example | Kind=submission | Domain=example.com | Url=https://example.com/path | Match=first_match",
        );
    });

    it("blockquotes every line when body placeholder is in blockquote form", () => {
        const result = valueWithPlaceholdersReplaced(
            "Before\n> {{body}}\nAfter",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "Before\n> line one\n> line two\nAfter");
    });

    it("supports blockquote body and normal body placeholders in same template", () => {
        const result = valueWithPlaceholdersReplaced(
            "> {{body}}\n\nPlain: {{body}}",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "> line one\n> line two\n\nPlain: line one\nline two");
    });

    it("supports optional spaces between > and {{body}}", () => {
        const result = valueWithPlaceholdersReplaced(
            "Start\n>    {{body}}\nEnd",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "Start\n> line one\n> line two\nEnd");
    });
});
