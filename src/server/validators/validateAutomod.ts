import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { parseRules } from "../core/ruleParser";

export const validateAutomodSetting = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    try {
        parseRules(validationRequest.value);
    } catch (e) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: (e as Error).message,
        }, 400);
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
