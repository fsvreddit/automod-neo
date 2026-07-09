import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { handleAppInstall, handleAppUpgrade, handleCommentCreate, handleCommentUpdate, handleModAction, handlePostCreate, handlePostUpdate } from "./triggers";
import { validateAutomodSetting, validateDiscordWebhook } from "./validators";

const application = new Hono();

// Triggers
application.post("/internal/triggers/on-app-install", handleAppInstall);
application.post("/internal/triggers/on-app-upgrade", handleAppUpgrade);
application.post("/internal/triggers/on-post-create", handlePostCreate);
application.post("/internal/triggers/on-post-update", handlePostUpdate);
application.post("/internal/triggers/on-comment-create", handleCommentCreate);
application.post("/internal/triggers/on-comment-update", handleCommentUpdate);
application.post("/internal/triggers/on-mod-action", handleModAction);

// Settings validators
application.post("/internal/validators/validate-automod-setting", validateAutomodSetting);
application.post("/internal/validators/validate-discord-webhook", validateDiscordWebhook);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
