export type WebhookProvider = "discord" | "slack";

export interface ParsedWebhookUrl {
    provider: WebhookProvider;
    url: string;
}

const webhookPathSegmentPattern = /^[A-Za-z0-9_-]+$/;

function isWebhookPathSegment (value: string | undefined): value is string {
    return value !== undefined && webhookPathSegmentPattern.test(value);
}

export function parseWebhookUrl (value: string): ParsedWebhookUrl | undefined {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return;
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(trimmedValue);
    } catch {
        return;
    }

    if (
        parsedUrl.protocol !== "https:"
        || parsedUrl.username
        || parsedUrl.password
        || parsedUrl.search
        || parsedUrl.hash
        || parsedUrl.pathname.endsWith("/")
    ) {
        return;
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (
        (hostname === "discord.com" || hostname === "discordapp.com")
        && pathSegments.length === 4
        && pathSegments[0] === "api"
        && pathSegments[1] === "webhooks"
        && /^\d+$/.test(pathSegments[2] ?? "")
        && isWebhookPathSegment(pathSegments[3])
    ) {
        return {
            provider: "discord",
            url: trimmedValue,
        };
    }

    if (
        hostname === "hooks.slack.com"
        && pathSegments.length === 4
        && pathSegments[0] === "services"
        && isWebhookPathSegment(pathSegments[1])
        && isWebhookPathSegment(pathSegments[2])
        && isWebhookPathSegment(pathSegments[3])
    ) {
        return {
            provider: "slack",
            url: trimmedValue,
        };
    }

    return;
}

export function getWebhookPayload (provider: WebhookProvider, message: string): { content: string } | { text: string } {
    if (provider === "discord") {
        return {
            content: message,
        };
    }

    return {
        text: message,
    };
}
