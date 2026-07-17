import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { TZDate } from "@date-fns/tz";
import { Context } from "hono";

export function isTimeZoneValid (timeZone: string): boolean {
    try {
        const zone = TZDate.tz(timeZone);
        return !isNaN(zone.getTime());
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error validating time zone "${timeZone}": ${message}`);
        return false;
    }
}

export const validateTimeZone = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    if (!isTimeZoneValid(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: `Invalid time zone format "${validationRequest.value}". Please provide a valid IANA time zone, abbreviation, or UTC offset.`,
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
