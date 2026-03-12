import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { createUser, loginUser } from "../repo/inMemoryStore.js";

const authBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(32).optional(),
  avatarHeroId: z.number().int().positive().optional()
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = authBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("register request validation failed", {
      event: "auth.register.invalid_payload",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const displayName = parsed.data.name?.trim() || normalizedEmail;
    const user = await createUser(
      normalizedEmail,
      parsed.data.password,
      displayName,
      parsed.data.avatarHeroId
    );
    const login = await loginUser(normalizedEmail, parsed.data.password);
    logger.info("user registered", {
      event: "auth.register.succeeded",
      userId: user.id,
      hasCustomAvatar: parsed.data.avatarHeroId != null
    });
    res.status(201).json({ user, token: login.token });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      logger.warn("register request rejected: email already exists", {
        event: "auth.register.email_exists"
      });
      res.status(409).json({ message: "EMAIL_EXISTS" });
      return;
    }
    if (error instanceof Error && error.message === "INVALID_AVATAR") {
      logger.warn("register request rejected: invalid avatar", {
        event: "auth.register.invalid_avatar"
      });
      res.status(400).json({ message: "INVALID_AVATAR" });
      return;
    }
    logger.error("register request failed", {
      event: "auth.register.failed",
      error
    });
    res.status(500).json({ message: "REGISTER_FAILED" });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = authBodySchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    logger.warn("login request validation failed", {
      event: "auth.login.invalid_payload",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    logger.info("user logged in", {
      event: "auth.login.succeeded",
      userId: result.user.id
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      logger.warn("login request rejected: invalid credentials", {
        event: "auth.login.invalid_credentials"
      });
      res.status(401).json({ message: "INVALID_CREDENTIALS" });
      return;
    }
    logger.error("login request failed", {
      event: "auth.login.failed",
      error
    });
    res.status(500).json({ message: "LOGIN_FAILED" });
  }
});
