import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { getUserByToken } from "../repo/inMemoryStore.js";
import {
  createThread,
  getThreadDetail,
  listThreads,
  resolveApprovalAndContinue,
  startAgentRun
} from "../services/agent/agentRuntimeService.js";

const createThreadSchema = z.object({
  language: z.enum(["zh-CN", "en-US"]),
  title: z.string().min(1).max(120).optional()
});

const runRequestSchema = z.object({
  message: z.string().min(2),
  mode: z.enum(["quick", "coach"]),
  language: z.enum(["zh-CN", "en-US"]),
  approvalPolicy: z.enum(["always", "auto"])
});

const approvalSchema = z.object({
  decision: z.enum(["approve", "reject"])
});

function resolveUserId(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return getUserByToken(token)?.id ?? null;
}

export const agentRouter = Router();

agentRouter.get("/threads", (req, res) => {
  const userId = resolveUserId(req.header("authorization"));
  if (!userId) {
    res.json({ items: [] });
    return;
  }

  res.json({ items: listThreads(userId) });
});

agentRouter.post("/threads", (req, res) => {
  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  const userId = resolveUserId(req.header("authorization"));
  const thread = createThread({
    userId,
    language: parsed.data.language,
    title: parsed.data.title
  });
  res.status(201).json({ thread });
});

agentRouter.get("/threads/:threadId", (req, res) => {
  const detail = getThreadDetail(req.params.threadId);
  if (!detail) {
    res.status(404).json({ message: "THREAD_NOT_FOUND" });
    return;
  }

  const userId = resolveUserId(req.header("authorization"));
  if (detail.thread.userId && detail.thread.userId !== userId) {
    res.status(403).json({ message: "FORBIDDEN" });
    return;
  }

  res.json(detail);
});

agentRouter.post("/threads/:threadId/runs", async (req, res) => {
  const parsed = runRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("agent run validation failed", {
      event: "agent.run.invalid_payload",
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root")
    });
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const userId = resolveUserId(req.header("authorization"));
    const detail = await startAgentRun({
      threadId: req.params.threadId,
      userId,
      ...parsed.data
    });
    res.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_FAILED";
    if (message === "THREAD_NOT_FOUND") {
      res.status(404).json({ message });
      return;
    }
    if (message === "INVALID_MESSAGE") {
      res.status(400).json({ message });
      return;
    }

    logger.error("agent run failed", {
      event: "agent.run.failed",
      error
    });
    res.status(500).json({ message: "AGENT_RUN_FAILED" });
  }
});

agentRouter.post("/runs/:runId/approvals/:approvalId", async (req, res) => {
  const parsed = approvalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const detail = await resolveApprovalAndContinue({
      runId: req.params.runId,
      approvalId: req.params.approvalId,
      decision: parsed.data.decision
    });
    res.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_APPROVAL_FAILED";
    if (message === "RUN_NOT_FOUND") {
      res.status(404).json({ message });
      return;
    }

    logger.error("agent approval failed", {
      event: "agent.approval.failed",
      error
    });
    res.status(500).json({ message: "AGENT_APPROVAL_FAILED" });
  }
});
