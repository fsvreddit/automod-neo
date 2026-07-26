import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { parseWebhookUrl } from "../core/webhookUtils";

export const validateDiscordOrSlackWebhook = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    if (!parseWebhookUrl(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid Discord or Slack webhook URL format.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
