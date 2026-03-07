import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { logger } from "./lib/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { agentRouter } from "./routes/agentRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import { contentRouter } from "./routes/contentRoutes.js";
import { userRouter } from "./routes/userRoutes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(requestLogger);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", contentRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/chat", chatRouter);
  app.use("/api/v1/agent", agentRouter);

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    logger.error("request failed with unhandled error", {
      event: "http.request.failed",
      method: req.method,
      path: req.originalUrl || req.url,
      error
    });

    if (res.headersSent) {
      return;
    }

    if (error instanceof SyntaxError) {
      res.status(400).json({ message: "INVALID_JSON" });
      return;
    }

    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  };

  app.use(errorHandler);

  return app;
}
