import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isTimeZoneValid } from "./validateTimeZone";

describe("isTimeZoneValid", () => {
    it("returns true for valid IANA time zones", () => {
        assert.equal(isTimeZoneValid("America/New_York"), true, "America/New_York is a valid IANA time zone");
        assert.equal(isTimeZoneValid("Europe/London"), true, "Europe/London is a valid IANA time zone");
        assert.equal(isTimeZoneValid("Asia/Tokyo"), true, "Asia/Tokyo is a valid IANA time zone");
    });

    it("returns true for UTC offset time zones", () => {
        assert.equal(isTimeZoneValid("+02:00"), true, "UTC+2 is a valid offset");
        assert.equal(isTimeZoneValid("-08:00"), true, "UTC-8 is a valid offset");
    });

    it("returns false for invalid values", () => {
        assert.equal(isTimeZoneValid("Not/A_Real_Zone"), false, "Not/A_Real_Zone is not a valid time zone");
        assert.equal(isTimeZoneValid("Mars/Base"), false, "Mars/Base is not a valid time zone");
        assert.equal(isTimeZoneValid("UTC+1:99"), false, "UTC+1:99 is not a valid offset");
    });
});
