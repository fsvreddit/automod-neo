import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { handleAppInstall, handleAppUpgrade, handleCommentReport, handleCommentSubmit, handleCommentUpdate, handleModAction, handlePostReport, handlePostSubmit, handlePostUpdate } from "./triggers";
import { validateAutomodSetting, validateDiscordOrSlackWebhook, validateTimeZone } from "./validators";
import { handleUpgradeNotifier } from "@fsvreddit/fsv-devvit-web-helpers";

const application = new Hono();

// Triggers
application.post("/internal/triggers/on-app-install", handleAppInstall);
application.post("/internal/triggers/on-app-upgrade", handleAppUpgrade);
application.post("/internal/triggers/on-comment-report", handleCommentReport);
application.post("/internal/triggers/on-comment-submit", handleCommentSubmit);
application.post("/internal/triggers/on-comment-update", handleCommentUpdate);
application.post("/internal/triggers/on-post-report", handlePostReport);
application.post("/internal/triggers/on-post-submit", handlePostSubmit);
application.post("/internal/triggers/on-post-update", handlePostUpdate);
application.post("/internal/triggers/on-mod-action", handleModAction);

// Settings validators
application.post("/internal/validators/validate-automod-setting", validateAutomodSetting);
application.post("/internal/validators/validate-discord-or-slack-webhook", validateDiscordOrSlackWebhook);
application.post("/internal/validators/validate-time-zone", validateTimeZone);

// Scheduler jobs
application.post("/internal/tasks/check-for-updates", handleUpgradeNotifier);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
