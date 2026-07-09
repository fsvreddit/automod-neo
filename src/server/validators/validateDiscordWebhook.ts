import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";

export const validateDiscordWebhook = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    const discordWebhookRegex = /^https:\/\/discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    if (!discordWebhookRegex.test(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid Discord webhook URL format.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
