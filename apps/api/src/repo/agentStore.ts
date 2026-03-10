import type {
  AgentKind,
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionStatus,
  AgentSessionSummary,
  Language
} from "@dotagame/contracts";
import { randomUUID } from "node:crypto";

const sessions = new Map<string, AgentSession>();
const messagesBySession = new Map<string, AgentMessage[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function cloneMessagePart(part: AgentMessagePart): AgentMessagePart {
  if (part.type === "tool_call") {
    return {
      ...part,
      citations: part.citations.map((citation) => ({ ...citation }))
    };
  }

  return { ...part };
}

function cloneMessage(message: AgentMessage): AgentMessage {
  return {
    ...message,
    parts: message.parts.map(cloneMessagePart)
  };
}

function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.set(sessionId, {
    ...session,
    updatedAt: nowIso()
  });
}

export function createAgentSession(input: {
  userId: string | null;
  parentSessionId: string | null;
  language: Language;
  agent: AgentKind;
  kind: "primary" | "subagent";
  title?: string;
  status?: AgentSessionStatus;
}): AgentSession {
  const id = randomUUID();
  const parent = input.parentSessionId ? sessions.get(input.parentSessionId) : null;
  const timestamp = nowIso();
  const session: AgentSession = {
    id,
    userId: input.userId,
    parentSessionId: input.parentSessionId,
    rootSessionId: parent?.rootSessionId ?? id,
    title: input.title?.trim() || "New Agent Session",
    language: input.language,
    agent: input.agent,
    kind: input.kind,
    status: input.status ?? "idle",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  sessions.set(id, session);
  messagesBySession.set(id, []);
  if (input.parentSessionId) {
    touchSession(input.parentSessionId);
  }
  return { ...session };
}

export function getAgentSession(sessionId: string): AgentSession | null {
  const session = sessions.get(sessionId);
  return session ? { ...session } : null;
}

export function updateAgentSession(input: AgentSession): AgentSession {
  const updated: AgentSession = {
    ...input,
    updatedAt: nowIso()
  };
  sessions.set(updated.id, updated);
  if (updated.parentSessionId) {
    touchSession(updated.parentSessionId);
  }
  return { ...updated };
}

export function updateAgentSessionTitle(sessionId: string, title: string): AgentSession | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  return updateAgentSession({
    ...session,
    title: title.trim() || session.title
  });
}

export function updateAgentSessionStatus(
  sessionId: string,
  status: AgentSessionStatus
): AgentSession | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  return updateAgentSession({
    ...session,
    status
  });
}

export function addAgentMessage(input: {
  sessionId: string;
  role: AgentMessage["role"];
  agent: AgentMessage["agent"];
  content: string;
  parts?: AgentMessagePart[];
}): AgentMessage {
  const message: AgentMessage = {
    id: randomUUID(),
    sessionId: input.sessionId,
    role: input.role,
    agent: input.agent,
    content: input.content,
    parts: (input.parts ?? []).map(cloneMessagePart),
    createdAt: nowIso()
  };

  const list = messagesBySession.get(input.sessionId) ?? [];
  list.push(message);
  messagesBySession.set(input.sessionId, list);
  touchSession(input.sessionId);
  return cloneMessage(message);
}

export function updateAgentMessage(input: AgentMessage): AgentMessage | null {
  const list = messagesBySession.get(input.sessionId);
  if (!list) {
    return null;
  }

  const index = list.findIndex((message) => message.id === input.id);
  if (index < 0) {
    return null;
  }

  list[index] = {
    ...input,
    parts: input.parts.map(cloneMessagePart)
  };
  messagesBySession.set(input.sessionId, list);
  touchSession(input.sessionId);
  return cloneMessage(list[index]);
}

export function listAgentSessionSummaries(userId: string): AgentSessionSummary[] {
  return [...sessions.values()]
    .filter((session) => session.userId === userId && session.parentSessionId == null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(toSessionSummary);
}

export function listChildSessionSummaries(parentSessionId: string): AgentSessionSummary[] {
  return [...sessions.values()]
    .filter((session) => session.parentSessionId === parentSessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(toSessionSummary);
}

export function buildAgentSessionDetail(sessionId: string): AgentSessionDetail | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  return {
    session: { ...session },
    messages: (messagesBySession.get(sessionId) ?? []).map(cloneMessage),
    children: listChildSessionSummaries(sessionId)
  };
}

function toSessionSummary(session: AgentSession): AgentSessionSummary {
  const messages = messagesBySession.get(session.id) ?? [];
  return {
    id: session.id,
    title: session.title,
    language: session.language,
    agent: session.agent,
    kind: session.kind,
    parentSessionId: session.parentSessionId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    lastMessage: messages[messages.length - 1]?.content ?? "",
    childCount: [...sessions.values()].filter((item) => item.parentSessionId === session.id).length
  };
}
