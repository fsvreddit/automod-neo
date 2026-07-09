export enum AppSetting {
    // Subreddit-scoped settings
    Rules = "rules",
    DiscordWebhookUrl = "discordWebhookUrl",
}

export interface SubredditSettings {
    [AppSetting.Rules]: string;
    [AppSetting.DiscordWebhookUrl]?: string;
}
