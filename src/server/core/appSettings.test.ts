import assert from "node:assert/strict";
import { describe, it } from "vitest";
import devvitConfig from "../../../devvit.json";
import { AppSetting } from "./appSettings.js";

const configSettingKeys = [
    ...Object.keys(devvitConfig.settings.subreddit),
].sort();

const appSettingValues: string[] = Object.values(AppSetting).sort();

describe("AppSetting configuration parity", () => {
    it("has a devvit.json setting for every AppSetting enum value", () => {
        const missingFromConfig = appSettingValues.filter(setting => !configSettingKeys.includes(setting));

        assert.deepEqual(missingFromConfig, []);
    });

    it("has an AppSetting enum value for every devvit.json setting", () => {
        const missingFromEnum = configSettingKeys.filter(setting => !appSettingValues.includes(setting));

        assert.deepEqual(missingFromEnum, []);
    });
});
