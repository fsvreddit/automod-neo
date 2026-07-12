import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@devvit/web/server", () => ({
    context: {},
    reddit: {},
}));

vi.mock("@devvit/web/shared", () => ({
    isT1: () => false,
    isT3: () => true,
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

import { ActionRules } from "./actionRules";
import { AutomodRule, Matches } from "../types";
import { Post } from "@devvit/web/server";
import { T3 } from "@devvit/web/shared";

const baseTarget = {
    authorName: "example_author",
    body: "line one\nline two",
    permalink: "/r/test/comments/abc123/example",
    subredditName: "test",
    url: "https://example.com/path",
} as unknown as Post;

const blankRule: AutomodRule = {};

describe("valueWithPlaceholdersReplaced", () => {
    const actionRules = new ActionRules({ targetId: "abc123" as T3, matchedRules: [] });
    it("returns undefined when input is undefined", () => {
        const result = actionRules.valueWithPlaceholdersReplaced(undefined, baseTarget, { rule: blankRule, matches: [] });

        assert.equal(result, undefined);
    });

    it("replaces standard placeholders", () => {
        const matches: Matches[] = [{
            category: "title",
            matches: ["first_match"],
        }];

        const result = actionRules.valueWithPlaceholdersReplaced(
            "Author={{author}} | Body={{body}} | Link={{permalink}} | Kind={{kind}} | Domain={{domain}} | Url={{url}} | Match={{match}}",
            {
                // eslint-disable-next-line @typescript-eslint/no-misused-spread
                ...baseTarget,
                title: "My title",
            } as unknown as Post,
            { rule: blankRule, matches },
        );

        assert.equal(
            result,
            "Author=example\\_author | Body=line one\nline two | Link=https://www.reddit.com/r/test/comments/abc123/example | Kind=submission | Domain=example.com | Url=https://example.com/path | Match=first_match",
        );
    });

    it("blockquotes every line when body placeholder is in blockquote form", () => {
        const result = actionRules.valueWithPlaceholdersReplaced(
            "Before\n> {{body}}\nAfter",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "Before\n> line one\n> line two\nAfter");
    });

    it("supports blockquote body and normal body placeholders in same template", () => {
        const result = actionRules.valueWithPlaceholdersReplaced(
            "> {{body}}\n\nPlain: {{body}}",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "> line one\n> line two\n\nPlain: line one\nline two");
    });

    it("supports optional spaces between > and {{body}}", () => {
        const result = actionRules.valueWithPlaceholdersReplaced(
            "Start\n>    {{body}}\nEnd",
            baseTarget,
            { rule: blankRule, matches: [] },
        );

        assert.equal(result, "Start\n> line one\n> line two\nEnd");
    });
});
