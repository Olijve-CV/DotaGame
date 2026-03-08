import type { AgentToolName, ChatCitation, ChatMode, Language } from "@dotagame/contracts";

export interface AgentResearchPacket {
  tool: AgentToolName;
  summary: string;
  citations: ChatCitation[];
}

export type AgentExecutionPhase = "research" | "coach" | "completed";

export type AgentExecutionStateStatus = "running" | "paused" | "completed" | "failed";

export interface AgentExecutionState {
  sessionId: string;
  userId: string | null;
  question: string;
  mode: ChatMode;
  language: Language;
  status: AgentExecutionStateStatus;
  phase: AgentExecutionPhase;
  abortRequested: boolean;
  researcherSessionId: string | null;
  coachSessionId: string | null;
  packets: AgentResearchPacket[];
  completedTools: AgentToolName[];
  pendingTools: AgentToolName[];
  planSummary: string;
  planRationale: string;
  researchSummary: string | null;
  finalAnswer: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

const executionStates = new Map<string, AgentExecutionState>();

function nowIso(): string {
  return new Date().toISOString();
}

function cloneState(state: AgentExecutionState): AgentExecutionState {
  return {
    ...state,
    packets: state.packets.map((packet) => ({
      ...packet,
      citations: packet.citations.map((citation) => ({ ...citation }))
    })),
    completedTools: [...state.completedTools],
    pendingTools: [...state.pendingTools]
  };
}

export function createAgentExecutionState(input: {
  sessionId: string;
  userId: string | null;
  question: string;
  mode: ChatMode;
  language: Language;
}): AgentExecutionState {
  const timestamp = nowIso();
  const state: AgentExecutionState = {
    sessionId: input.sessionId,
    userId: input.userId,
    question: input.question,
    mode: input.mode,
    language: input.language,
    status: "running",
    phase: "research",
    abortRequested: false,
    researcherSessionId: null,
    coachSessionId: null,
    packets: [],
    completedTools: [],
    pendingTools: [],
    planSummary: "",
    planRationale: "",
    researchSummary: null,
    finalAnswer: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  executionStates.set(input.sessionId, state);
  return cloneState(state);
}

export function getAgentExecutionState(sessionId: string): AgentExecutionState | null {
  const state = executionStates.get(sessionId);
  return state ? cloneState(state) : null;
}

export function updateAgentExecutionState(
  sessionId: string,
  updater: (state: AgentExecutionState) => AgentExecutionState
): AgentExecutionState | null {
  const current = executionStates.get(sessionId);
  if (!current) {
    return null;
  }

  const next = updater(cloneState(current));
  const updated: AgentExecutionState = {
    ...next,
    updatedAt: nowIso()
  };
  executionStates.set(sessionId, updated);
  return cloneState(updated);
}

export function clearAgentExecutionAbort(sessionId: string): AgentExecutionState | null {
  return updateAgentExecutionState(sessionId, (state) => ({
    ...state,
    abortRequested: false
  }));
}

export function resetAgentExecutionState(sessionId: string): AgentExecutionState | null {
  const current = executionStates.get(sessionId);
  if (!current) {
    return null;
  }

  return updateAgentExecutionState(sessionId, (state) => ({
    ...state,
    status: "running",
    phase: "research",
    abortRequested: false,
    researcherSessionId: null,
    coachSessionId: null,
    packets: [],
    completedTools: [],
    pendingTools: [],
    planSummary: "",
    planRationale: "",
    researchSummary: null,
    finalAnswer: null,
    lastError: null
  }));
}
