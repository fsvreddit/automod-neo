import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";

export const validateDiscordOrSlackWebhook = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    const discordOrSlackWebhookRegex = /^https:\/\/(?:discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+|hooks\.slack\.com\/services\/[\w-]+)$/;
    if (!discordOrSlackWebhookRegex.test(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid Discord or Slack webhook URL format.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
