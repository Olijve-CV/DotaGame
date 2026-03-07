import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { listHeroAvatars } from "../services/heroAvatarService.js";
import { listArticles, listPatchNotes, listTournaments } from "../services/contentService.js";

const querySchema = z.object({
  language: z.enum(["zh-CN", "en-US"]).optional(),
  query: z.string().optional(),
  category: z.enum(["news", "tournament", "patch", "guide"]).optional()
});

export const contentRouter = Router();

function logContentRouteFailure(
  event: string,
  message: string,
  error: unknown,
  details: Record<string, unknown> = {}
): void {
  logger.error(message, {
    event,
    ...details,
    error
  });
}

contentRouter.get("/articles", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    logger.warn("article query validation failed", {
      event: "content.articles.invalid_query",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_QUERY" });
    return;
  }

  try {
    const items = await listArticles({
      language: parsed.data.language,
      category: parsed.data.category,
      query: parsed.data.query
    });
    res.json({ items });
  } catch (error) {
    logContentRouteFailure("content.articles.failed", "failed to load articles", error, {
      language: parsed.data.language,
      category: parsed.data.category
    });
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});

contentRouter.get("/patch-notes", async (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  try {
    res.json({ items: await listPatchNotes(parsedLanguage) });
  } catch (error) {
    logContentRouteFailure("content.patch_notes.failed", "failed to load patch notes", error, {
      language: parsedLanguage
    });
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});

contentRouter.get("/tournaments", async (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  try {
    res.json({ items: await listTournaments(parsedLanguage) });
  } catch (error) {
    logContentRouteFailure("content.tournaments.failed", "failed to load tournaments", error, {
      language: parsedLanguage
    });
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});

contentRouter.get("/hero-avatars", async (_req, res) => {
  try {
    res.json({ items: await listHeroAvatars() });
  } catch (error) {
    logContentRouteFailure(
      "content.hero_avatars.failed",
      "failed to load hero avatars",
      error
    );
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});
