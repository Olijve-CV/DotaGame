import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  addFavorite,
  getChatSessions,
  getFavorites,
  removeFavorite,
  updateUserAvatar
} from "../repo/inMemoryStore.js";

const favoriteSchema = z.object({
  contentType: z.enum(["article", "patch", "tournament"]),
  contentId: z.string().min(1)
});
const avatarSchema = z.object({
  avatarHeroId: z.number().int().positive().nullable().optional()
});

export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get("/me", (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

userRouter.patch("/me/avatar", async (req: AuthenticatedRequest, res) => {
  const parsed = avatarSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("avatar update validation failed", {
      event: "user.avatar.invalid_payload",
      userId: req.user!.id,
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const user = await updateUserAvatar(req.user!.id, parsed.data.avatarHeroId ?? null);
    req.user = user;
    logger.info("user avatar updated", {
      event: "user.avatar.updated",
      userId: user.id,
      avatarHeroId: user.avatar.id
    });
    res.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AVATAR") {
      logger.warn("avatar update rejected: invalid avatar", {
        event: "user.avatar.invalid_avatar",
        userId: req.user!.id
      });
      res.status(400).json({ message: "INVALID_AVATAR" });
      return;
    }
    logger.error("avatar update failed", {
      event: "user.avatar.failed",
      userId: req.user!.id,
      error
    });
    res.status(500).json({ message: "PROFILE_UPDATE_FAILED" });
  }
});

userRouter.get("/me/favorites", (req: AuthenticatedRequest, res) => {
  res.json({ items: getFavorites(req.user!.id) });
});

userRouter.post("/me/favorites", (req: AuthenticatedRequest, res) => {
  const parsed = favoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("favorite update validation failed", {
      event: "user.favorites.invalid_payload",
      userId: req.user!.id,
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }
  const items = addFavorite(req.user!.id, parsed.data.contentType, parsed.data.contentId);
  logger.info("favorite added", {
    event: "user.favorites.added",
    userId: req.user!.id,
    contentType: parsed.data.contentType,
    contentId: parsed.data.contentId,
    totalFavorites: items.length
  });
  res.status(201).json({ items });
});

userRouter.delete("/me/favorites/:contentType/:contentId", (req: AuthenticatedRequest, res) => {
  const contentType = req.params.contentType;
  const contentId = req.params.contentId;
  if (contentType !== "article" && contentType !== "patch" && contentType !== "tournament") {
    logger.warn("favorite removal validation failed", {
      event: "user.favorites.invalid_content_type",
      userId: req.user!.id,
      contentType
    });
    res.status(400).json({ message: "INVALID_CONTENT_TYPE" });
    return;
  }
  const items = removeFavorite(req.user!.id, contentType, contentId);
  logger.info("favorite removed", {
    event: "user.favorites.removed",
    userId: req.user!.id,
    contentType,
    contentId,
    totalFavorites: items.length
  });
  res.json({ items });
});

userRouter.get("/me/chat-sessions", (req: AuthenticatedRequest, res) => {
  res.json({ items: getChatSessions(req.user!.id) });
});
