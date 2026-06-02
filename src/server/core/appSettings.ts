import { settings } from "@devvit/web/server";

export enum AppSetting {
    // Subreddit-scoped settings
    Rules = "rules",
}

export interface SubredditSettings {
    [AppSetting.Rules]: string;
}

export async function getSettings (): Promise<SubredditSettings> {
    const appSettings = await settings.getAll();
    return {
        [AppSetting.Rules]: appSettings[AppSetting.Rules] as string,
    };
}
