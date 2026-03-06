import { Router } from "express";
import { z } from "zod";
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
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const user = await updateUserAvatar(req.user!.id, parsed.data.avatarHeroId ?? null);
    req.user = user;
    res.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AVATAR") {
      res.status(400).json({ message: "INVALID_AVATAR" });
      return;
    }
    res.status(500).json({ message: "PROFILE_UPDATE_FAILED" });
  }
});

userRouter.get("/me/favorites", (req: AuthenticatedRequest, res) => {
  res.json({ items: getFavorites(req.user!.id) });
});

userRouter.post("/me/favorites", (req: AuthenticatedRequest, res) => {
  const parsed = favoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }
  const items = addFavorite(req.user!.id, parsed.data.contentType, parsed.data.contentId);
  res.status(201).json({ items });
});

userRouter.delete("/me/favorites/:contentType/:contentId", (req: AuthenticatedRequest, res) => {
  const contentType = req.params.contentType;
  const contentId = req.params.contentId;
  if (contentType !== "article" && contentType !== "patch" && contentType !== "tournament") {
    res.status(400).json({ message: "INVALID_CONTENT_TYPE" });
    return;
  }
  const items = removeFavorite(req.user!.id, contentType, contentId);
  res.json({ items });
});

userRouter.get("/me/chat-sessions", (req: AuthenticatedRequest, res) => {
  res.json({ items: getChatSessions(req.user!.id) });
});
