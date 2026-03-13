import "dotenv/config";
import { createApp } from "./app.js";
import { getDatabaseInfo } from "./lib/database.js";
import { logger } from "./lib/logger.js";
import { startContentSyncScheduler, warmContentStore } from "./services/contentSyncService.js";
import { getRagConfig } from "./services/rag/config.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const ragConfig = getRagConfig();
const databaseInfo = getDatabaseInfo();
await warmContentStore();
const stopContentSyncScheduler = startContentSyncScheduler();

const server = app.listen(port, () => {
  logger.info("API server started", {
    event: "server.started",
    port,
    environment: process.env.NODE_ENV ?? "development",
    dbProvider: databaseInfo.provider,
    sqlitePath: databaseInfo.sqlitePath ?? undefined,
    databaseUrlConfigured: databaseInfo.hasDatabaseUrl,
    liveSourcesEnabled: process.env.USE_LIVE_SOURCES !== "false",
    vectorStoreProvider: ragConfig.vectorStoreProvider,
    openAiConfigured: Boolean(ragConfig.openAiApiKey)
  });
});

server.on("error", (error) => {
  logger.error("API server failed to start", {
    event: "server.start_failed",
    port,
    error
  });
});

server.on("close", () => {
  stopContentSyncScheduler();
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    event: "process.unhandled_rejection",
    error: reason
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    event: "process.uncaught_exception",
    error
  });
});
