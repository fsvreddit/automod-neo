import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getWebhookPayload, parseWebhookUrl } from "./webhookUtils";

describe("parseWebhookUrl", () => {
    it("accepts current and legacy Discord webhook hosts", () => {
        assert.deepEqual(
            parseWebhookUrl("https://discord.com/api/webhooks/123456/abc_DEF-789"),
            {
                provider: "discord",
                url: "https://discord.com/api/webhooks/123456/abc_DEF-789",
            },
        );
        assert.deepEqual(
            parseWebhookUrl("https://discordapp.com/api/webhooks/123456/abc_DEF-789"),
            {
                provider: "discord",
                url: "https://discordapp.com/api/webhooks/123456/abc_DEF-789",
            },
        );
    });

    it("accepts complete Slack incoming-webhook URLs", () => {
        assert.deepEqual(
            parseWebhookUrl("  https://hooks.slack.com/services/T01234567/B01234567/abc_DEF-789  "),
            {
                provider: "slack",
                url: "https://hooks.slack.com/services/T01234567/B01234567/abc_DEF-789",
            },
        );
    });

    it("rejects incomplete, insecure, and look-alike webhook URLs", () => {
        const invalidUrls = [
            "https://hooks.slack.com/services/T01234567",
            "http://hooks.slack.com/services/T01234567/B01234567/abc_DEF-789",
            "https://hooks.slack.com.evil.example/services/T01234567/B01234567/abc_DEF-789",
            "https://discord.com/api/webhooks/not-a-number/abc_DEF-789",
            "https://discord.com/api/webhooks/123456/abc_DEF-789?wait=true",
        ];

        for (const invalidUrl of invalidUrls) {
            assert.equal(parseWebhookUrl(invalidUrl), undefined);
        }
    });
});

describe("getWebhookPayload", () => {
    it("uses the Slack text payload", () => {
        assert.deepEqual(getWebhookPayload("slack", "Test message"), {
            text: "Test message",
        });
    });

    it("uses the Discord content payload for both Discord hosts", () => {
        const currentDiscord = parseWebhookUrl("https://discord.com/api/webhooks/123456/abc_DEF-789");
        const legacyDiscord = parseWebhookUrl("https://discordapp.com/api/webhooks/123456/abc_DEF-789");

        assert.ok(currentDiscord);
        assert.ok(legacyDiscord);
        assert.equal(currentDiscord.provider, "discord");
        assert.equal(legacyDiscord.provider, "discord");
        assert.deepEqual(getWebhookPayload(currentDiscord.provider, "Test message"), {
            content: "Test message",
        });
        assert.deepEqual(getWebhookPayload(legacyDiscord.provider, "Test message"), {
            content: "Test message",
        });
    });
});
