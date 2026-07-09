import { settings } from "@devvit/web/server";

export enum AppSetting {
    // Subreddit-scoped settings
    Rules = "rules",
    DiscordWebhookUrl = "discordWebhookUrl",
}

export interface SubredditSettings {
    [AppSetting.Rules]: string;
    [AppSetting.DiscordWebhookUrl]?: string;
}

export async function getSettings (): Promise<SubredditSettings> {
    const appSettings = await settings.getAll();
    return {
        [AppSetting.Rules]: appSettings[AppSetting.Rules] as string,
        [AppSetting.DiscordWebhookUrl]: appSettings[AppSetting.DiscordWebhookUrl] as string | undefined,
    };
}
