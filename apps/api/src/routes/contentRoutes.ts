import { Router } from "express";
import { z } from "zod";
import { listArticles, listPatchNotes, listTournaments } from "../services/contentService.js";

const querySchema = z.object({
  language: z.enum(["zh-CN", "en-US"]).optional(),
  query: z.string().optional(),
  category: z.enum(["news", "tournament", "patch", "guide"]).optional()
});

export const contentRouter = Router();

contentRouter.get("/articles", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
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
  } catch {
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});

contentRouter.get("/patch-notes", async (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  try {
    res.json({ items: await listPatchNotes(parsedLanguage) });
  } catch {
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});

contentRouter.get("/tournaments", async (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  try {
    res.json({ items: await listTournaments(parsedLanguage) });
  } catch {
    res.status(502).json({ message: "CONTENT_SOURCE_ERROR" });
  }
});
