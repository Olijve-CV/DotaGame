import type {
  AgentApprovalPolicy,
  AgentApprovalRequest,
  AgentMessage,
  AgentRun,
  AgentThread,
  AgentThreadDetail,
  AgentThreadSummary,
  AgentToolName,
  ChatCitation,
  ChatMode,
  Language
} from "@dotagame/contracts";
import { randomUUID } from "node:crypto";

interface AgentResearchPacket {
  tool: AgentToolName;
  summary: string;
  citations: ChatCitation[];
}

export interface AgentRunEntity extends AgentRun {
  userId: string | null;
  question: string;
  approvalPolicy: AgentApprovalPolicy;
  pendingTool: AgentToolName | null;
  pendingToolInput: string | null;
  pendingToolReason: string | null;
  researchPackets: AgentResearchPacket[];
}

const threads = new Map<string, AgentThread>();
const messagesByThread = new Map<string, AgentMessage[]>();
const runsByThread = new Map<string, AgentRunEntity[]>();
const runsById = new Map<string, AgentRunEntity>();

function nowIso(): string {
  return new Date().toISOString();
}

function touchThread(threadId: string): void {
  const thread = threads.get(threadId);
  if (!thread) {
    return;
  }

  threads.set(threadId, {
    ...thread,
    updatedAt: nowIso()
  });
}

function cloneRun(run: AgentRunEntity): AgentRunEntity {
  return {
    ...run,
    steps: run.steps.map((step) => ({
      ...step,
      toolCall: step.toolCall
        ? {
            ...step.toolCall,
            citations: step.toolCall.citations?.map((citation) => ({ ...citation }))
          }
        : undefined
    })),
    approvals: run.approvals.map((approval) => ({ ...approval })),
    citations: run.citations.map((citation) => ({ ...citation })),
    researchPackets: run.researchPackets.map((packet) => ({
      ...packet,
      citations: packet.citations.map((citation) => ({ ...citation }))
    }))
  };
}

export function createAgentThread(input: {
  userId: string | null;
  language: Language;
  title?: string;
}): AgentThread {
  const timestamp = nowIso();
  const thread: AgentThread = {
    id: randomUUID(),
    userId: input.userId,
    language: input.language,
    title: input.title?.trim() || "New Agent Thread",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  threads.set(thread.id, thread);
  messagesByThread.set(thread.id, []);
  runsByThread.set(thread.id, []);
  return thread;
}

export function getAgentThread(threadId: string): AgentThread | null {
  const thread = threads.get(threadId);
  return thread ? { ...thread } : null;
}

export function updateAgentThreadTitle(threadId: string, title: string): AgentThread | null {
  const thread = threads.get(threadId);
  if (!thread) {
    return null;
  }

  const nextThread: AgentThread = {
    ...thread,
    title: title.trim() || thread.title,
    updatedAt: nowIso()
  };
  threads.set(threadId, nextThread);
  return { ...nextThread };
}

export function listAgentThreadSummaries(userId: string): AgentThreadSummary[] {
  const ownedThreads = [...threads.values()]
    .filter((thread) => thread.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return ownedThreads.map((thread) => {
    const messages = messagesByThread.get(thread.id) ?? [];
    const runs = runsByThread.get(thread.id) ?? [];
    const lastMessage = messages[messages.length - 1]?.content ?? "";
    const status = runs[0]?.status ?? "idle";
    return {
      id: thread.id,
      title: thread.title,
      language: thread.language,
      updatedAt: thread.updatedAt,
      lastMessage,
      status
    };
  });
}

export function addAgentMessage(input: {
  threadId: string;
  runId: string | null;
  role: AgentMessage["role"];
  agent: AgentMessage["agent"];
  content: string;
}): AgentMessage {
  const message: AgentMessage = {
    id: randomUUID(),
    threadId: input.threadId,
    runId: input.runId,
    role: input.role,
    agent: input.agent,
    content: input.content,
    createdAt: nowIso()
  };

  const list = messagesByThread.get(input.threadId) ?? [];
  list.push(message);
  messagesByThread.set(input.threadId, list);
  touchThread(input.threadId);
  return { ...message };
}

export function createAgentRun(input: {
  threadId: string;
  userId: string | null;
  question: string;
  mode: ChatMode;
  language: Language;
  approvalPolicy: AgentApprovalPolicy;
  summary: string;
}): AgentRunEntity {
  const timestamp = nowIso();
  const run: AgentRunEntity = {
    id: randomUUID(),
    threadId: input.threadId,
    userId: input.userId,
    question: input.question,
    mode: input.mode,
    language: input.language,
    approvalPolicy: input.approvalPolicy,
    status: "running",
    summary: input.summary,
    createdAt: timestamp,
    updatedAt: timestamp,
    steps: [],
    approvals: [],
    citations: [],
    pendingTool: null,
    pendingToolInput: null,
    pendingToolReason: null,
    researchPackets: []
  };

  const list = runsByThread.get(input.threadId) ?? [];
  list.unshift(run);
  runsByThread.set(input.threadId, list);
  runsById.set(run.id, run);
  touchThread(input.threadId);
  return cloneRun(run);
}

export function getAgentRun(runId: string): AgentRunEntity | null {
  const run = runsById.get(runId);
  return run ? cloneRun(run) : null;
}

export function saveAgentRun(run: AgentRunEntity): AgentRunEntity {
  const updated = {
    ...run,
    updatedAt: nowIso()
  };
  runsById.set(updated.id, updated);

  const list = runsByThread.get(updated.threadId) ?? [];
  const nextList = list.map((item) => (item.id === updated.id ? updated : item));
  runsByThread.set(updated.threadId, nextList);
  touchThread(updated.threadId);
  return cloneRun(updated);
}

export function addAgentRunStep(
  runId: string,
  step: Omit<AgentRun["steps"][number], "id" | "runId" | "createdAt">
): AgentRunEntity {
  const run = runsById.get(runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  run.steps.push({
    id: randomUUID(),
    runId,
    createdAt: nowIso(),
    ...step
  });
  return saveAgentRun(run);
}

export function addAgentApproval(
  runId: string,
  input: {
    tool: AgentToolName;
    reason: string;
    inputSummary: string;
  }
): AgentApprovalRequest {
  const run = runsById.get(runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  const approval: AgentApprovalRequest = {
    id: randomUUID(),
    runId,
    tool: input.tool,
    status: "pending",
    reason: input.reason,
    inputSummary: input.inputSummary,
    createdAt: nowIso()
  };

  run.approvals.push(approval);
  saveAgentRun(run);
  return { ...approval };
}

export function resolveAgentApproval(
  runId: string,
  approvalId: string,
  status: "approved" | "rejected"
): AgentRunEntity {
  const run = runsById.get(runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  run.approvals = run.approvals.map((approval) =>
    approval.id === approvalId
      ? {
          ...approval,
          status,
          resolvedAt: nowIso()
        }
      : approval
  );

  return saveAgentRun(run);
}

export function appendAgentResearchPacket(
  runId: string,
  packet: AgentResearchPacket
): AgentRunEntity {
  const run = runsById.get(runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  run.researchPackets.push({
    ...packet,
    citations: packet.citations.map((citation) => ({ ...citation }))
  });
  run.citations = dedupeCitations(
    run.researchPackets.flatMap((item) => item.citations)
  );
  return saveAgentRun(run);
}

export function buildAgentThreadDetail(threadId: string): AgentThreadDetail | null {
  const thread = threads.get(threadId);
  if (!thread) {
    return null;
  }

  const messages = (messagesByThread.get(threadId) ?? []).map((message) => ({ ...message }));
  const runs = (runsByThread.get(threadId) ?? []).map((run) => cloneRun(run));

  return {
    thread: { ...thread },
    messages,
    runs
  };
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
