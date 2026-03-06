import cors from "cors";
import express from "express";
import { authRouter } from "./routes/authRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import { contentRouter } from "./routes/contentRoutes.js";
import { userRouter } from "./routes/userRoutes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", contentRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/chat", chatRouter);

  return app;
}
