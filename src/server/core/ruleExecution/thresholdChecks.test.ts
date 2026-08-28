import assert from "node:assert/strict";
import { subDays, subHours, subMinutes, subMonths, subWeeks, subYears } from "date-fns";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { meetsDateThreshold, meetsNumericThreshold } from "./thresholdChecks.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("meetsNumericThreshold", () => {
    it("supports '=' operator", () => {
        assert.equal(meetsNumericThreshold(10, "=10"), true);
        assert.equal(meetsNumericThreshold(9, "=10"), false);
    });

    it("supports '<' operator", () => {
        assert.equal(meetsNumericThreshold(9, "< 10"), true);
        assert.equal(meetsNumericThreshold(10, "< 10"), false);
    });

    it("supports '<=' operator", () => {
        assert.equal(meetsNumericThreshold(10, "<= 10"), true);
        assert.equal(meetsNumericThreshold(11, "<= 10"), false);
    });

    it("supports '>' operator", () => {
        assert.equal(meetsNumericThreshold(11, "> 10"), true);
        assert.equal(meetsNumericThreshold(10, "> 10"), false);
    });

    it("supports '>=' operator", () => {
        assert.equal(meetsNumericThreshold(10, ">= 10"), true);
        assert.equal(meetsNumericThreshold(9, ">= 10"), false);
    });

    it("handles negative values", () => {
        assert.equal(meetsNumericThreshold(-5, "<= -5"), true);
        assert.equal(meetsNumericThreshold(-4, "< -5"), false);
    });

    it("returns false for malformed thresholds", () => {
        assert.equal(meetsNumericThreshold(10, "ten"), false);
    });
});

describe("meetsDateThreshold", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("supports '<' operator", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 5), "< 10 days"), true);
        assert.equal(meetsDateThreshold(subDays(NOW, 15), "< 10 days"), false);
    });

    it("supports '<=' operator", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 10), "<= 10 days"), true);
        assert.equal(meetsDateThreshold(subDays(NOW, 11), "<= 10 days"), false);
    });

    it("supports '>' operator", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 15), "> 10 days"), true);
        assert.equal(meetsDateThreshold(subDays(NOW, 5), "> 10 days"), false);
    });

    it("supports '>=' operator", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 10), ">= 10 days"), true);
        assert.equal(meetsDateThreshold(subDays(NOW, 9), ">= 10 days"), false);
    });

    it("supports each date unit", () => {
        const unitCases = [
            { unit: "minute", sub: subMinutes },
            { unit: "hour", sub: subHours },
            { unit: "day", sub: subDays },
            { unit: "week", sub: subWeeks },
            { unit: "month", sub: subMonths },
            { unit: "year", sub: subYears },
        ] as const;

        for (const { unit, sub } of unitCases) {
            const olderInput = sub(NOW, 3);
            const newerInput = sub(NOW, 1);

            assert.equal(meetsDateThreshold(olderInput, `> 2 ${unit}s`), true);
            assert.equal(meetsDateThreshold(newerInput, `> 2 ${unit}s`), false);
        }
    });

    it("returns false without an operator unless defaultOperator is provided", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 5), "10 days"), false);
        assert.equal(meetsDateThreshold(subDays(NOW, 5), "10 days", "<"), true);
    });

    it("accepts Unix timestamp inputs in seconds", () => {
        const fiveDaysAgoSeconds = Math.floor(subDays(NOW, 5).getTime() / 1000);
        assert.equal(meetsDateThreshold(fiveDaysAgoSeconds, "< 10 days"), true);
    });

    it("accepts Unix timestamp inputs in milliseconds", () => {
        const fiveDaysAgoMilliseconds = subDays(NOW, 5).getTime();
        assert.equal(meetsDateThreshold(fiveDaysAgoMilliseconds, "< 10 days"), true);
    });

    it("returns false for malformed thresholds", () => {
        assert.equal(meetsDateThreshold(subDays(NOW, 5), "sometime"), false);
    });
});
