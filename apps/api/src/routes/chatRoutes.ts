import { Router } from "express";
import { z } from "zod";
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

chatRouter.post("/", (req, res) => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  const response = answerChat(parsed.data);

  const header = req.header("authorization");
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
    }
  }

  res.json(response);
});
