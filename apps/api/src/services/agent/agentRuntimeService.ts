import type {
  AgentSessionStatus,
  AgentToolName,
  ChatCitation,
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
  createAgentExecutionState,
  getAgentExecutionState,
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
      titleFallback: "? Agent ??",
      rootRunning: "? Agent ????? Agent ???????",
      planMessage: "Orchestrator ??????????",
      researcherSession: "Researcher ???",
      coachSession: "Coach ???",
      researcherStart: "Researcher ?????????????",
      researcherDone: "Researcher ????????",
      coachStart: "Coach ???????????????",
      coachDone: "Coach ????????",
      researcherTask: "??? Researcher ? Agent",
      coachTask: "??? Coach ? Agent",
      finalPrefix: "????",
      nextActions: "?????",
      sources: "??"
    };
  }

  return {
    titleFallback: "New Agent Session",
    rootRunning: "The primary agent is coordinating subagents.",
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
    sources: "Sources"
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
    input.language === "zh-CN"
      ? "1. ????????????????????????????"
      : "1. Break the issue into lane, timing, and teamfight phases before making changes.",
    input.language === "zh-CN"
      ? "2. ???????????????????????????"
      : "2. Add your hero, lane, rank, and timing window if you want a sharper follow-up.",
    input.language === "zh-CN"
      ? "3. ?????????????? BP ??????????????"
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

async function beginResearcherPhase(sessionId: string): Promise<void> {
  const state = getExecutionStateOrThrow(sessionId);
  if (state.researcherSessionId) {
    return;
  }

  const copy = getCopy(state.language);
  const plan = await buildAgentExecutionPlan({
    question: state.question,
    language: state.language
  });

  const researcherSession = createAgentSession({
    userId: state.userId,
    parentSessionId: sessionId,
    language: state.language,
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

    const nextState = getExecutionStateOrThrow(sessionId);
    const replan = await replanAgentExecution({
      question: nextState.question,
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
      mode: "coach",
      language: state.language
    });
  }

  logger.info("agent session turn completed", {
    event: "agent.session.completed",
    sessionId,
    language: state.language,
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
  beginCoachPhase(sessionId);

  const state = getExecutionStateOrThrow(sessionId);
  if (!state.coachSessionId) {
    throw new Error("COACH_SESSION_NOT_FOUND");
  }

  const copy = getCopy(state.language);
  const finalAnswer = buildCoachAnswer({
    question: state.question,
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
      if (state.status === "completed") {
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

