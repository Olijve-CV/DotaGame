import { Router, text } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { answerChat } from "../services/chatService.js";
import { addChatSession, getUserByToken } from "../repo/inMemoryStore.js";

const chatBodySchema = z.object({
  question: z.string().min(2),
  mode: z.enum(["quick", "coach"]),
  language: z.enum(["zh-CN", "en-US"]),
  context: z
    .object({
      hero: z.string().optional(),
      rank: z.string().optional(),
      lane: z.string().optional()
    })
    .optional()
});

export const chatRouter = Router();

chatRouter.use(text({ type: "text/plain" }));

function normalizeChatBody(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

chatRouter.post("/", async (req, res) => {
  const parsed = chatBodySchema.safeParse(normalizeChatBody(req.body));
  if (!parsed.success) {
    logger.warn("chat request validation failed", {
      event: "chat.invalid_payload",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const response = await answerChat(parsed.data);

    const header = req.header("authorization");
    let sessionUserId: string | null = null;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice("Bearer ".length).trim();
      const user = getUserByToken(token);
      if (user) {
        addChatSession({
          userId: user.id,
          question: parsed.data.question,
          answer: response.answer,
          mode: parsed.data.mode,
          language: parsed.data.language
        });
        sessionUserId = user.id;
      }
    }

    logger.info("chat response generated", {
      event: "chat.completed",
      mode: parsed.data.mode,
      language: parsed.data.language,
      citations: response.citations.length,
      confidence: response.confidence,
      persistedSession: sessionUserId != null,
      userId: sessionUserId
    });

    res.json(response);
  } catch (error) {
    logger.error("chat request failed", {
      event: "chat.failed",
      mode: parsed.data.mode,
      language: parsed.data.language,
      error
    });
    res.status(500).json({ message: "CHAT_FAILED" });
  }
});
