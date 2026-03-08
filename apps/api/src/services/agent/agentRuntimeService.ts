import type {
  AgentSessionStatus,
  AgentToolName,
  ChatCitation,
  ChatMode,
  Language
} from "@dotagame/contracts";
import {
  addAgentMessage,
  buildAgentSessionDetail,
  createAgentSession,
  getAgentSession,
  listAgentSessionSummaries,
  listChildSessionSummaries,
  updateAgentSession,
  updateAgentSessionStatus,
  updateAgentSessionTitle
} from "../../repo/agentStore.js";
import { addChatSession } from "../../repo/inMemoryStore.js";
import { logger } from "../../lib/logger.js";
import { publishAgentSessionEvent } from "./agentEventBus.js";
import {
  clearAgentExecutionAbort,
  createAgentExecutionState,
  getAgentExecutionState,
  resetAgentExecutionState,
  updateAgentExecutionState,
  type AgentResearchPacket
} from "./agentExecutionStore.js";
import { buildAgentExecutionPlan, replanAgentExecution } from "./agentPlannerService.js";
import { runDotaLiveSearch, runKnowledgeSearch, runWebSearch } from "./agentTools.js";

const activeTurns = new Set<string>();
const TOOL_CHECKPOINT_DELAY_MS = process.env.NODE_ENV === "test" ? 20 : 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCopy(language: Language) {
  if (language === "zh-CN") {
    return {
      titleFallback: "新 Agent Session",
      rootRunning: "主 Agent 正在协调子智能体处理这次任务。",
      rootCompleted: "主 Agent 已完成这轮任务。",
      rootPaused: "当前任务已暂停，可稍后继续。",
      rootResumed: "继续执行上一次未完成的任务。",
      rootRetrying: "重新运行上一条任务。",
      planMessage: "Orchestrator 已生成这轮任务计划。",
      researcherSession: "Researcher 子会话",
      coachSession: "Coach 子会话",
      researcherStart: "Researcher 已接收任务并开始搜集证据。",
      researcherDone: "Researcher 已完成证据搜集。",
      coachStart: "Coach 已接收证据并开始整理最终回答。",
      coachDone: "Coach 已完成最终回答。",
      researcherTask: "派发给 Researcher 子智能体",
      coachTask: "派发给 Coach 子智能体",
      finalPrefix: "最终回答",
      nextActions: "建议下一步",
      sources: "来源",
      subagentOnly: "这是子智能体会话，只读，不接受直接输入。"
    };
  }

  return {
    titleFallback: "New Agent Session",
    rootRunning: "The primary agent is coordinating subagents.",
    rootCompleted: "The primary agent completed this turn.",
    rootPaused: "This turn is paused and can be resumed later.",
    rootResumed: "Resuming the unfinished task in this root session.",
    rootRetrying: "Retrying the last mission in this root session.",
    planMessage: "The orchestrator generated a task plan.",
    researcherSession: "Researcher Subsession",
    coachSession: "Coach Subsession",
    researcherStart: "The researcher received the task and started gathering evidence.",
    researcherDone: "The researcher finished collecting evidence.",
    coachStart: "The coach received the evidence and started synthesizing the answer.",
    coachDone: "The coach finished composing the conclusion.",
    researcherTask: "Dispatch to Researcher subagent",
    coachTask: "Dispatch to Coach subagent",
    finalPrefix: "Final answer",
    nextActions: "Recommended next actions",
    sources: "Sources",
    subagentOnly: "This is a subagent session. It is view-only and does not accept direct user prompts."
  };
}

function buildSessionTitle(message: string, language: Language): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return getCopy(language).titleFallback;
  }
  return trimmed.slice(0, 52);
}

function dedupeCitations(citations: ChatCitation[]): ChatCitation[] {
  const seen = new Set<string>();
  const result: ChatCitation[] = [];
  for (const citation of citations) {
    const key = `${citation.id}:${citation.sourceUrl}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ ...citation });
  }
  return result;
}

function formatCitationList(citations: ChatCitation[]): string {
  return citations
    .slice(0, 4)
    .map((citation, index) => `${index + 1}. ${citation.title} (${citation.source})`)
    .join("\n");
}

function buildCoachAnswer(input: {
  question: string;
  mode: ChatMode;
  language: Language;
  packets: AgentResearchPacket[];
}): string {
  const copy = getCopy(input.language);
  const knowledgePacket = input.packets.find((packet) => packet.tool === "knowledge_search");
  const dotaLivePacket = input.packets.find((packet) => packet.tool === "dota_live_search");
  const webPacket = input.packets.find((packet) => packet.tool === "web_search");
  const citations = dedupeCitations(input.packets.flatMap((packet) => packet.citations));

  const lines: string[] = [`${copy.finalPrefix}: ${input.question}`];

  if (knowledgePacket?.summary) {
    lines.push("", knowledgePacket.summary);
  }
  if (dotaLivePacket?.summary) {
    lines.push("", dotaLivePacket.summary);
  }
  if (webPacket?.summary) {
    lines.push("", webPacket.summary);
  }

  lines.push(
    "",
    `${copy.nextActions}:`,
    input.mode === "coach"
      ? input.language === "zh-CN"
        ? "1. 先按对线、节奏点、团战三个阶段拆开复盘。"
        : "1. Break the issue into lane, timing, and teamfight phases before making changes."
      : input.language === "zh-CN"
        ? "1. 先确认这是不是一个依赖最新版本、赛事或环境的时效性问题。"
        : "1. Confirm whether this is time-sensitive and depends on the latest patch or tournament meta.",
    input.language === "zh-CN"
      ? "2. 如果要继续问，补充英雄、分路、段位和关键时间点。"
      : "2. Add your hero, lane, rank, and timing window if you want a sharper follow-up.",
    input.language === "zh-CN"
      ? "3. 你也可以继续追问某个版本、英雄或 BP 细节。"
      : "3. Use the sources below to ask follow-ups about a patch, hero, or draft detail."
  );

  if (citations.length > 0) {
    lines.push("", `${copy.sources}:`, formatCitationList(citations));
  }

  return lines.join("\n");
}

function publishDetailEvent(sessionId: string): void {
  const detail = buildAgentSessionDetail(sessionId);
  if (!detail) {
    return;
  }

  publishAgentSessionEvent({
    type: "session.detail",
    sessionId,
    rootSessionId: detail.session.rootSessionId,
    detail,
    timestamp: new Date().toISOString()
  });
}

function publishRootAndSession(sessionId: string): void {
  const session = getAgentSession(sessionId);
  if (!session) {
    return;
  }

  publishDetailEvent(sessionId);
  if (session.rootSessionId !== sessionId) {
    publishDetailEvent(session.rootSessionId);
  }
}

function getExecutionStateOrThrow(sessionId: string) {
  const state = getAgentExecutionState(sessionId);
  if (!state) {
    throw new Error("SESSION_EXECUTION_NOT_FOUND");
  }
  return state;
}

function updateChildStatusIfPresent(sessionId: string | null, status: AgentSessionStatus): void {
  if (!sessionId) {
    return;
  }

  const session = getAgentSession(sessionId);
  if (!session) {
    return;
  }

  if (session.status !== status) {
    updateAgentSessionStatus(sessionId, status);
  }
}

async function executeResearchTool(
  sessionId: string,
  tool: AgentToolName,
  question: string,
  language: Language
): Promise<AgentResearchPacket> {
  if (TOOL_CHECKPOINT_DELAY_MS > 0) {
    await wait(TOOL_CHECKPOINT_DELAY_MS);
  }

  if (tool === "knowledge_search") {
    const result = await runKnowledgeSearch(question, language);
    addAgentMessage({
      sessionId,
      role: "tool",
      agent: "researcher",
      content: result.summary,
      parts: [
        {
          type: "tool_call",
          tool,
          status: "completed",
          inputSummary: question,
          outputSummary: result.summary,
          citations: result.citations
        }
      ]
    });
    publishRootAndSession(sessionId);
    return { tool, summary: result.summary, citations: result.citations };
  }

  if (tool === "dota_live_search") {
    const result = await runDotaLiveSearch(question, language);
    addAgentMessage({
      sessionId,
      role: "tool",
      agent: "researcher",
      content: result.summary,
      parts: [
        {
          type: "tool_call",
          tool,
          status: "completed",
          inputSummary: question,
          outputSummary: result.summary,
          citations: result.citations
        }
      ]
    });
    publishRootAndSession(sessionId);
    return { tool, summary: result.summary, citations: result.citations };
  }

  const result = await runWebSearch(question, language);
  addAgentMessage({
    sessionId,
    role: "tool",
    agent: "researcher",
    content: result.summary,
    parts: [
      {
        type: "tool_call",
        tool,
        status: "completed",
        inputSummary: question,
        outputSummary: result.summary,
        citations: result.citations
      }
    ]
  });
  publishRootAndSession(sessionId);
  return { tool, summary: result.summary, citations: result.citations };
}

function markExecutionPaused(sessionId: string): void {
  const state = getAgentExecutionState(sessionId);
  if (!state || state.status === "paused") {
    return;
  }

  const copy = getCopy(state.language);
  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    status: "paused",
    abortRequested: false,
    lastError: null
  }));
  updateAgentSessionStatus(sessionId, "paused");
  updateChildStatusIfPresent(state.researcherSessionId, state.phase === "research" ? "paused" : "completed");
  updateChildStatusIfPresent(state.coachSessionId, state.phase === "coach" ? "paused" : "completed");
  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.rootPaused,
    parts: [{ type: "text", text: copy.rootPaused }]
  });
  publishRootAndSession(sessionId);
}

function shouldPauseAtCheckpoint(sessionId: string): boolean {
  const state = getAgentExecutionState(sessionId);
  if (!state?.abortRequested) {
    return false;
  }

  markExecutionPaused(sessionId);
  return true;
}

async function beginResearcherPhase(sessionId: string): Promise<void> {
  const state = getExecutionStateOrThrow(sessionId);
  if (state.researcherSessionId) {
    return;
  }

  const copy = getCopy(state.language);
  const plan = await buildAgentExecutionPlan({
    question: state.question,
    mode: state.mode,
    language: state.language
  });

  const researcherSession = createAgentSession({
    userId: state.userId,
    parentSessionId: sessionId,
    language: state.language,
    mode: state.mode,
    agent: "researcher",
    kind: "subagent",
    title: `${copy.researcherSession}: ${state.question.slice(0, 36)}`,
    status: "running"
  });

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.researcherTask,
    parts: [
      {
        type: "task_call",
        taskId: `task-${researcherSession.id}`,
        subagent: "researcher",
        status: "running",
        childSessionId: researcherSession.id,
        instruction: plan.summary,
        summary: plan.rationale
      }
    ]
  });

  addAgentMessage({
    sessionId: researcherSession.id,
    role: "assistant",
    agent: "researcher",
    content: copy.researcherStart,
    parts: [{ type: "text", text: `${plan.summary}\n${plan.rationale}` }]
  });

  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    researcherSessionId: researcherSession.id,
    pendingTools: plan.tools.slice(0, 1),
    planSummary: plan.summary,
    planRationale: plan.rationale
  }));

  publishRootAndSession(researcherSession.id);
}

function finalizeResearcherPhase(sessionId: string): void {
  const state = getExecutionStateOrThrow(sessionId);
  if (!state.researcherSessionId) {
    return;
  }

  const copy = getCopy(state.language);
  const summary =
    state.researchSummary ||
    (state.language === "zh-CN"
      ? `Researcher 已使用 ${state.completedTools.join(" -> ")} 完成证据搜集。`
      : `The researcher completed evidence gathering with ${state.completedTools.join(" -> ")}.`);

  addAgentMessage({
    sessionId: state.researcherSessionId,
    role: "assistant",
    agent: "researcher",
    content: copy.researcherDone,
    parts: [{ type: "text", text: summary }]
  });
  updateAgentSessionStatus(state.researcherSessionId, "completed");

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.researcherTask,
    parts: [
      {
        type: "task_call",
        taskId: `task-${state.researcherSessionId}-completed`,
        subagent: "researcher",
        status: "completed",
        childSessionId: state.researcherSessionId,
        instruction: state.planSummary || copy.researcherTask,
        summary
      }
    ]
  });

  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    phase: "coach",
    pendingTools: [],
    researchSummary: summary
  }));

  publishRootAndSession(state.researcherSessionId);
}

async function runResearchPhase(sessionId: string): Promise<void> {
  await beginResearcherPhase(sessionId);

  while (true) {
    if (shouldPauseAtCheckpoint(sessionId)) {
      return;
    }

    const state = getExecutionStateOrThrow(sessionId);
    if (state.phase !== "research") {
      return;
    }
    if (!state.researcherSessionId) {
      throw new Error("RESEARCHER_SESSION_NOT_FOUND");
    }

    const nextTool = state.pendingTools[0];
    if (!nextTool) {
      finalizeResearcherPhase(sessionId);
      return;
    }

    const packet = await executeResearchTool(
      state.researcherSessionId,
      nextTool,
      state.question,
      state.language
    );

    updateAgentExecutionState(sessionId, (current) => ({
      ...current,
      packets: [...current.packets, packet],
      completedTools: [...current.completedTools, nextTool],
      pendingTools: current.pendingTools.filter((tool) => tool !== nextTool),
      lastError: null
    }));

    if (shouldPauseAtCheckpoint(sessionId)) {
      return;
    }

    const nextState = getExecutionStateOrThrow(sessionId);
    const replan = await replanAgentExecution({
      question: nextState.question,
      mode: nextState.mode,
      language: nextState.language,
      completedTools: nextState.completedTools,
      packets: nextState.packets
    });

    if (replan.done || replan.nextTools.length === 0) {
      updateAgentExecutionState(sessionId, (current) => ({
        ...current,
        pendingTools: [],
        planSummary: replan.summary,
        planRationale: replan.rationale,
        researchSummary: replan.summary
      }));
      finalizeResearcherPhase(sessionId);
      return;
    }

    addAgentMessage({
      sessionId: state.researcherSessionId,
      role: "assistant",
      agent: "researcher",
      content: replan.summary,
      parts: [{ type: "text", text: `${replan.summary}\n${replan.rationale}` }]
    });

    updateAgentExecutionState(sessionId, (current) => ({
      ...current,
      pendingTools: replan.nextTools,
      planSummary: replan.summary,
      planRationale: replan.rationale
    }));

    publishRootAndSession(state.researcherSessionId);
  }
}

function beginCoachPhase(sessionId: string): void {
  const state = getExecutionStateOrThrow(sessionId);
  if (state.coachSessionId) {
    return;
  }

  const copy = getCopy(state.language);
  const coachSession = createAgentSession({
    userId: state.userId,
    parentSessionId: sessionId,
    language: state.language,
    mode: state.mode,
    agent: "coach",
    kind: "subagent",
    title: `${copy.coachSession}: ${state.question.slice(0, 36)}`,
    status: "running"
  });

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.coachTask,
    parts: [
      {
        type: "task_call",
        taskId: `task-${coachSession.id}`,
        subagent: "coach",
        status: "running",
        childSessionId: coachSession.id,
        instruction:
          state.language === "zh-CN"
            ? "基于 researcher 收集到的证据整理最终回答。"
            : "Produce the final answer from the researcher evidence.",
        summary:
          state.language === "zh-CN"
            ? "Coach 正在整合子会话里的证据。"
            : "The coach is synthesizing the child-session evidence."
      }
    ]
  });

  addAgentMessage({
    sessionId: coachSession.id,
    role: "assistant",
    agent: "coach",
    content: copy.coachStart,
    parts: [{ type: "text", text: copy.coachStart }]
  });

  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    coachSessionId: coachSession.id
  }));

  publishRootAndSession(coachSession.id);
}

function finalizeCompletedTurn(sessionId: string, finalAnswer: string): void {
  const state = getExecutionStateOrThrow(sessionId);

  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    phase: "completed",
    status: "completed",
    abortRequested: false,
    finalAnswer,
    lastError: null
  }));
  updateAgentSessionStatus(sessionId, "completed");

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: finalAnswer,
    parts: [{ type: "text", text: finalAnswer }]
  });

  publishRootAndSession(sessionId);

  if (state.userId) {
    addChatSession({
      userId: state.userId,
      question: state.question,
      answer: finalAnswer,
      mode: state.mode,
      language: state.language
    });
  }

  logger.info("agent session turn completed", {
    event: "agent.session.completed",
    sessionId,
    language: state.language,
    mode: state.mode,
    childSessions: listChildSessionSummaries(sessionId).length
  });

  const completedDetail = buildAgentSessionDetail(sessionId);
  if (completedDetail) {
    publishAgentSessionEvent({
      type: "session.completed",
      sessionId,
      rootSessionId: completedDetail.session.rootSessionId,
      detail: completedDetail,
      timestamp: new Date().toISOString()
    });
  }
}

function runCoachPhase(sessionId: string): void {
  if (shouldPauseAtCheckpoint(sessionId)) {
    return;
  }

  beginCoachPhase(sessionId);

  const state = getExecutionStateOrThrow(sessionId);
  if (!state.coachSessionId) {
    throw new Error("COACH_SESSION_NOT_FOUND");
  }

  const copy = getCopy(state.language);
  const finalAnswer = buildCoachAnswer({
    question: state.question,
    mode: state.mode,
    language: state.language,
    packets: state.packets
  });

  addAgentMessage({
    sessionId: state.coachSessionId,
    role: "assistant",
    agent: "coach",
    content: finalAnswer,
    parts: [{ type: "text", text: finalAnswer }]
  });
  updateAgentSessionStatus(state.coachSessionId, "completed");

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.coachTask,
    parts: [
      {
        type: "task_call",
        taskId: `task-${state.coachSessionId}-completed`,
        subagent: "coach",
        status: "completed",
        childSessionId: state.coachSessionId,
        instruction:
          state.language === "zh-CN"
            ? "基于 researcher 收集到的证据整理最终回答。"
            : "Produce the final answer from the researcher evidence.",
        summary: copy.coachDone
      }
    ]
  });

  publishRootAndSession(state.coachSessionId);
  finalizeCompletedTurn(sessionId, finalAnswer);
}

function markExecutionFailed(sessionId: string, error: unknown): void {
  const session = getAgentSession(sessionId);
  if (!session) {
    return;
  }

  const state = getAgentExecutionState(sessionId);
  const message = error instanceof Error ? error.message : "AGENT_SESSION_FAILED";

  updateAgentExecutionState(sessionId, (current) => ({
    ...current,
    status: "failed",
    abortRequested: false,
    lastError: message
  }));
  updateAgentSessionStatus(sessionId, "failed");

  if (state?.phase === "research") {
    updateChildStatusIfPresent(state.researcherSessionId, "failed");
  }
  if (state?.phase === "coach") {
    updateChildStatusIfPresent(state.coachSessionId, "failed");
  }

  addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: message,
    parts: [{ type: "text", text: message }]
  });
  publishRootAndSession(sessionId);

  publishAgentSessionEvent({
    type: "session.failed",
    sessionId,
    rootSessionId: session.rootSessionId,
    detail: buildAgentSessionDetail(sessionId) ?? undefined,
    error: message,
    timestamp: new Date().toISOString()
  });

  logger.error("agent session turn failed", {
    event: "agent.session.failed",
    sessionId,
    error
  });
}

async function runSessionTurn(sessionId: string): Promise<void> {
  if (activeTurns.has(sessionId)) {
    return;
  }

  activeTurns.add(sessionId);
  try {
    while (true) {
      const state = getExecutionStateOrThrow(sessionId);
      if (state.abortRequested) {
        markExecutionPaused(sessionId);
        return;
      }
      if (state.status === "paused" || state.status === "completed") {
        return;
      }

      if (state.phase === "research") {
        await runResearchPhase(sessionId);
        continue;
      }
      if (state.phase === "coach") {
        runCoachPhase(sessionId);
        return;
      }
      return;
    }
  } catch (error) {
    markExecutionFailed(sessionId, error);
  } finally {
    activeTurns.delete(sessionId);
  }
}

function startSessionTurn(sessionId: string): void {
  void runSessionTurn(sessionId);
}

export function createSession(input: {
  userId: string | null;
  language: Language;
  title?: string;
}) {
  return createAgentSession({
    userId: input.userId,
    parentSessionId: null,
    language: input.language,
    mode: "coach",
    agent: "orchestrator",
    kind: "primary",
    title: input.title,
    status: "idle"
  });
}

export function getSessionDetail(sessionId: string) {
  return buildAgentSessionDetail(sessionId);
}

export function listSessions(userId: string) {
  return listAgentSessionSummaries(userId);
}

export function listChildren(sessionId: string) {
  return listChildSessionSummaries(sessionId);
}

export async function sendMessageToSession(input: {
  sessionId: string;
  userId: string | null;
  message: string;
  mode: ChatMode;
  language: Language;
}) {
  const session = getAgentSession(input.sessionId);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }
  if (session.kind !== "primary") {
    throw new Error("SUBAGENT_SESSION_READ_ONLY");
  }
  if (activeTurns.has(input.sessionId)) {
    throw new Error("SESSION_BUSY");
  }

  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) {
    throw new Error("INVALID_MESSAGE");
  }

  const copy = getCopy(input.language);
  updateAgentSession({
    ...session,
    mode: input.mode,
    language: input.language,
    status: "running"
  });
  updateAgentSessionTitle(input.sessionId, buildSessionTitle(trimmedMessage, input.language));

  addAgentMessage({
    sessionId: input.sessionId,
    role: "user",
    agent: null,
    content: trimmedMessage,
    parts: [{ type: "text", text: trimmedMessage }]
  });

  addAgentMessage({
    sessionId: input.sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: copy.planMessage,
    parts: [{ type: "text", text: copy.rootRunning }]
  });

  createAgentExecutionState({
    sessionId: input.sessionId,
    userId: input.userId,
    question: trimmedMessage,
    mode: input.mode,
    language: input.language
  });

  publishRootAndSession(input.sessionId);
  startSessionTurn(input.sessionId);

  const detail = buildAgentSessionDetail(input.sessionId);
  if (!detail) {
    throw new Error("SESSION_NOT_FOUND");
  }
  return detail;
}

export async function controlSession(input: {
  sessionId: string;
  userId: string | null;
  action: "abort" | "resume" | "retry";
}) {
  const session = getAgentSession(input.sessionId);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }
  if (session.kind !== "primary") {
    throw new Error("SUBAGENT_SESSION_READ_ONLY");
  }

  const state = getAgentExecutionState(input.sessionId);
  if (!state) {
    throw new Error("SESSION_EXECUTION_NOT_FOUND");
  }

  const copy = getCopy(state.language);

  if (input.action === "abort") {
    if (!activeTurns.has(input.sessionId) && session.status !== "running") {
      throw new Error("SESSION_NOT_RUNNING");
    }

    updateAgentExecutionState(input.sessionId, (current) => ({
      ...current,
      abortRequested: true,
      status: "paused"
    }));
    updateAgentSessionStatus(input.sessionId, "paused");
    if (state.phase === "research") {
      updateChildStatusIfPresent(state.researcherSessionId, "paused");
    }
    if (state.phase === "coach") {
      updateChildStatusIfPresent(state.coachSessionId, "paused");
    }
    addAgentMessage({
      sessionId: input.sessionId,
      role: "assistant",
      agent: "orchestrator",
      content: copy.rootPaused,
      parts: [{ type: "text", text: copy.rootPaused }]
    });
    publishRootAndSession(input.sessionId);
  } else if (input.action === "resume") {
    if (state.status !== "paused" && session.status !== "failed") {
      throw new Error("SESSION_NOT_RESUMABLE");
    }

    clearAgentExecutionAbort(input.sessionId);
    updateAgentExecutionState(input.sessionId, (current) => ({
      ...current,
      status: "running",
      lastError: null
    }));
    updateAgentSessionStatus(input.sessionId, "running");
    if (state.phase === "research") {
      updateChildStatusIfPresent(state.researcherSessionId, "running");
    }
    if (state.phase === "coach") {
      updateChildStatusIfPresent(state.coachSessionId, "running");
    }
    addAgentMessage({
      sessionId: input.sessionId,
      role: "assistant",
      agent: "orchestrator",
      content: copy.rootResumed,
      parts: [{ type: "text", text: copy.rootResumed }]
    });
    publishRootAndSession(input.sessionId);
    if (!activeTurns.has(input.sessionId)) {
      startSessionTurn(input.sessionId);
    }
  } else {
    if (activeTurns.has(input.sessionId)) {
      throw new Error("SESSION_BUSY");
    }

    const retriedState = resetAgentExecutionState(input.sessionId);
    if (!retriedState) {
      throw new Error("SESSION_EXECUTION_NOT_FOUND");
    }

    updateAgentSession({
      ...session,
      mode: retriedState.mode,
      language: retriedState.language,
      status: "running"
    });
    addAgentMessage({
      sessionId: input.sessionId,
      role: "assistant",
      agent: "orchestrator",
      content: copy.rootRetrying,
      parts: [{ type: "text", text: copy.rootRetrying }]
    });
    publishRootAndSession(input.sessionId);
    startSessionTurn(input.sessionId);
  }

  const detail = buildAgentSessionDetail(input.sessionId);
  if (!detail) {
    throw new Error("SESSION_NOT_FOUND");
  }
  return detail;
}
