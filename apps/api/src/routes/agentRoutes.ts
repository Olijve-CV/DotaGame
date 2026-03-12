import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { getUserByToken } from "../repo/inMemoryStore.js";
import { subscribeAgentSessionEvents } from "../services/agent/agentEventBus.js";
import {
  createSession,
  getSessionDetail,
  listChildren,
  listSessions,
  sendMessageToSession
} from "../services/agent/agentRuntimeService.js";

const createSessionSchema = z.object({
  language: z.enum(["zh-CN", "en-US"]),
  title: z.string().min(1).max(120).optional()
});

const sendMessageSchema = z.object({
  message: z.string().min(2),
  language: z.enum(["zh-CN", "en-US"])
});

async function resolveUserIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) {
    return null;
  }
  return (await getUserByToken(token))?.id ?? null;
}

async function resolveUserId(header: string | undefined): Promise<string | null> {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return resolveUserIdFromToken(header.slice("Bearer ".length).trim());
}

export const agentRouter = Router();

agentRouter.get("/sessions", async (req, res) => {
  const userId = await resolveUserId(req.header("authorization"));
  if (!userId) {
    res.json({ items: [] });
    return;
  }

  res.json({ items: await listSessions(userId) });
});

agentRouter.post("/sessions", async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  const userId = await resolveUserId(req.header("authorization"));
  const session = await createSession({
    userId,
    language: parsed.data.language,
    title: parsed.data.title
  });
  res.status(201).json({ session });
});

agentRouter.get("/sessions/:sessionId", async (req, res) => {
  const detail = await getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const userId = await resolveUserId(req.header("authorization"));
  if (detail.session.userId && detail.session.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.json(detail);
});

agentRouter.get("/sessions/:sessionId/events", async (req, res) => {
  const detail = await getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const queryToken =
    typeof req.query.token === "string" && req.query.token.trim().length > 0
      ? req.query.token.trim()
      : undefined;
  const userId =
    (await resolveUserId(req.header("authorization"))) ?? (await resolveUserIdFromToken(queryToken));
  if (detail.session.userId && detail.session.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const rootSessionId = detail.session.rootSessionId;
  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("session.detail", {
    type: "session.detail",
    sessionId: detail.session.id,
    rootSessionId,
    detail,
    timestamp: new Date().toISOString()
  });

  const unsubscribe = subscribeAgentSessionEvents(rootSessionId, (event) => {
    sendEvent(event.type, event);
  });

  const keepAlive = setInterval(() => {
    sendEvent("keepalive", {
      type: "keepalive",
      sessionId: detail.session.id,
      rootSessionId,
      timestamp: new Date().toISOString()
    });
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
});

agentRouter.get("/sessions/:sessionId/children", async (req, res) => {
  const detail = await getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const userId = await resolveUserId(req.header("authorization"));
  if (detail.session.userId && detail.session.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.json({ items: await listChildren(req.params.sessionId) });
});

agentRouter.post("/sessions/:sessionId/messages", async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("agent session message validation failed", {
      event: "agent.session.invalid_payload",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const userId = await resolveUserId(req.header("authorization"));
    const detail = await sendMessageToSession({
      sessionId: req.params.sessionId,
      userId,
      ...parsed.data
    });
    res.status(202).json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SESSION_FAILED";
    if (
      message === "SESSION_NOT_FOUND" ||
      message === "INVALID_MESSAGE" ||
      message === "SUBAGENT_SESSION_READ_ONLY" ||
      message === "SESSION_BUSY"
    ) {
      res.status(message === "SESSION_NOT_FOUND" ? 404 : 400).json({ message });
      return;
    }

    logger.error("agent session message failed", {
      event: "agent.session.failed",
      error
    });
    res.status(500).json({ message: "AGENT_SESSION_FAILED" });
  }
});
