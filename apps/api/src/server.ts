import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { getRagConfig } from "./services/rag/config.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const ragConfig = getRagConfig();

const server = app.listen(port, () => {
  logger.info("API server started", {
    event: "server.started",
    port,
    environment: process.env.NODE_ENV ?? "development",
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
