import { Router } from "express";
import { z } from "zod";
import { listArticles, listPatchNotes, listTournaments } from "../services/contentService.js";

const querySchema = z.object({
  language: z.enum(["zh-CN", "en-US"]).optional(),
  query: z.string().optional(),
  category: z.enum(["news", "tournament", "patch", "guide"]).optional()
});

export const contentRouter = Router();

contentRouter.get("/articles", (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_QUERY" });
    return;
  }

  const items = listArticles({
    language: parsed.data.language,
    category: parsed.data.category,
    query: parsed.data.query
  });
  res.json({ items });
});

contentRouter.get("/patch-notes", (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  res.json({ items: listPatchNotes(parsedLanguage) });
});

contentRouter.get("/tournaments", (req, res) => {
  const language = req.query.language;
  const parsedLanguage = language === "zh-CN" || language === "en-US" ? language : undefined;
  res.json({ items: listTournaments(parsedLanguage) });
});
