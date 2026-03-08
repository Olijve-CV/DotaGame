import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { getUserByToken } from "../repo/inMemoryStore.js";
import { subscribeAgentSessionEvents } from "../services/agent/agentEventBus.js";
import {
  controlSession,
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
  mode: z.enum(["quick", "coach"]),
  language: z.enum(["zh-CN", "en-US"])
});

const controlSessionSchema = z.object({
  action: z.enum(["abort", "resume", "retry"])
});

function resolveUserIdFromToken(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  return getUserByToken(token)?.id ?? null;
}

function resolveUserId(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return resolveUserIdFromToken(header.slice("Bearer ".length).trim());
}

export const agentRouter = Router();

agentRouter.get("/sessions", (req, res) => {
  const userId = resolveUserId(req.header("authorization"));
  if (!userId) {
    res.json({ items: [] });
    return;
  }

  res.json({ items: listSessions(userId) });
});

agentRouter.post("/sessions", (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  const userId = resolveUserId(req.header("authorization"));
  const session = createSession({
    userId,
    language: parsed.data.language,
    title: parsed.data.title
  });
  res.status(201).json({ session });
});

agentRouter.get("/sessions/:sessionId", (req, res) => {
  const detail = getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const userId = resolveUserId(req.header("authorization"));
  if (detail.session.userId && detail.session.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.json(detail);
});

agentRouter.get("/sessions/:sessionId/events", (req, res) => {
  const detail = getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const queryToken =
    typeof req.query.token === "string" && req.query.token.trim().length > 0
      ? req.query.token.trim()
      : undefined;
  const userId = resolveUserId(req.header("authorization")) ?? resolveUserIdFromToken(queryToken);
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

agentRouter.get("/sessions/:sessionId/children", (req, res) => {
  const detail = getSessionDetail(req.params.sessionId);
  if (!detail) {
    res.status(404).json({ message: "SESSION_NOT_FOUND" });
    return;
  }

  const userId = resolveUserId(req.header("authorization"));
  if (detail.session.userId && detail.session.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.json({ items: listChildren(req.params.sessionId) });
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
    const userId = resolveUserId(req.header("authorization"));
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

agentRouter.post("/sessions/:sessionId/control", async (req, res) => {
  const parsed = controlSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const userId = resolveUserId(req.header("authorization"));
    const detail = await controlSession({
      sessionId: req.params.sessionId,
      userId,
      action: parsed.data.action
    });
    res.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SESSION_FAILED";
    if (
      message === "SESSION_NOT_FOUND" ||
      message === "SUBAGENT_SESSION_READ_ONLY" ||
      message === "SESSION_EXECUTION_NOT_FOUND" ||
      message === "SESSION_BUSY" ||
      message === "SESSION_NOT_RUNNING" ||
      message === "SESSION_NOT_RESUMABLE"
    ) {
      res.status(message === "SESSION_NOT_FOUND" ? 404 : 400).json({ message });
      return;
    }

    logger.error("agent session control failed", {
      event: "agent.session.control_failed",
      error,
      sessionId: req.params.sessionId,
      action: parsed.data.action
    });
    res.status(500).json({ message: "AGENT_SESSION_FAILED" });
  }
});
