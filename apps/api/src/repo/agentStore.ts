import type {
  AgentKind,
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionInsight,
  AgentSessionStatus,
  AgentSessionSummary,
  AgentToolUsage,
  Language
} from "@dotagame/contracts";
import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "../lib/database.js";

interface AgentSessionRow {
  id: string;
  user_id: string | null;
  parent_session_id: string | null;
  root_session_id: string;
  title: string;
  language: Language;
  agent: AgentKind;
  kind: "primary" | "subagent";
  status: AgentSessionStatus;
  created_at: string;
  updated_at: string;
}

interface AgentMessageRow {
  id: string;
  session_id: string;
  role: AgentMessage["role"];
  agent: AgentMessage["agent"];
  content: string;
  parts_json: string;
  created_at: string;
}

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

function parseMessageParts(raw: string): AgentMessagePart[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AgentMessagePart[]).map(cloneMessagePart) : [];
  } catch {
    return [];
  }
}

function toAgentSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    userId: row.user_id,
    parentSessionId: row.parent_session_id,
    rootSessionId: row.root_session_id,
    title: row.title,
    language: row.language,
    agent: row.agent,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAgentMessage(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    agent: row.agent,
    content: row.content,
    parts: parseMessageParts(row.parts_json),
    createdAt: row.created_at
  };
}

async function getSessionRow(sessionId: string): Promise<AgentSessionRow | null> {
  const db = await getDatabaseClient();
  return db.get<AgentSessionRow>(
    `
      SELECT
        id,
        user_id,
        parent_session_id,
        root_session_id,
        title,
        language,
        agent,
        kind,
        status,
        created_at,
        updated_at
      FROM agent_sessions
      WHERE id = :sessionId
    `,
    { sessionId }
  );
}

async function getMessagesForSession(sessionId: string): Promise<AgentMessage[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<AgentMessageRow>(
    `
      SELECT id, session_id, role, agent, content, parts_json, created_at
      FROM agent_messages
      WHERE session_id = :sessionId
      ORDER BY created_at ASC, id ASC
    `,
    { sessionId }
  );

  return rows.map(toAgentMessage);
}

function buildSessionInsight(messages: AgentMessage[]): AgentSessionInsight {
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
  const lastAnswerPreview =
    [...messages].reverse().find((message) => message.role === "assistant")?.content.trim() ?? "";
  const toolCalls = messages.flatMap((message) =>
    message.parts.filter(
      (part): part is Extract<AgentMessagePart, { type: "tool_call" }> => part.type === "tool_call"
    )
  );
  const citations = toolCalls.flatMap((part) => part.citations);
  const toolCountMap = new Map<AgentToolUsage["tool"], number>();

  for (const toolCall of toolCalls) {
    toolCountMap.set(toolCall.tool, (toolCountMap.get(toolCall.tool) ?? 0) + 1);
  }

  return {
    lastUserMessage,
    lastAnswerPreview,
    messageCount: messages.length,
    assistantTurnCount: messages.filter((message) => message.role === "assistant").length,
    toolCallCount: toolCalls.length,
    sourceCount: new Set(citations.map((citation) => `${citation.sourceUrl}:${citation.title}`)).size,
    activeTool:
      [...toolCalls].reverse().find((toolCall) => toolCall.status === "running")?.tool ?? null,
    tools: [...toolCountMap.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((left, right) => right.count - left.count || left.tool.localeCompare(right.tool))
  };
}

async function countChildren(sessionId: string): Promise<number> {
  const db = await getDatabaseClient();
  const row = await db.get<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM agent_sessions
      WHERE parent_session_id = :sessionId
    `,
    { sessionId }
  );
  return Number(row?.count ?? 0);
}

async function touchSession(sessionId: string): Promise<void> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      UPDATE agent_sessions
      SET updated_at = :updatedAt
      WHERE id = :sessionId
    `,
    {
      sessionId,
      updatedAt: nowIso()
    }
  );
}

async function toSessionSummary(row: AgentSessionRow): Promise<AgentSessionSummary> {
  const session = toAgentSession(row);
  const messages = await getMessagesForSession(session.id);

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
    childCount: await countChildren(session.id),
    insight: buildSessionInsight(messages)
  };
}

export async function createAgentSession(input: {
  userId: string | null;
  parentSessionId: string | null;
  language: Language;
  agent: AgentKind;
  kind: "primary" | "subagent";
  title?: string;
  status?: AgentSessionStatus;
}): Promise<AgentSession> {
  const id = randomUUID();
  const parent = input.parentSessionId ? await getSessionRow(input.parentSessionId) : null;
  const timestamp = nowIso();
  const session: AgentSession = {
    id,
    userId: input.userId,
    parentSessionId: input.parentSessionId,
    rootSessionId: parent?.root_session_id ?? id,
    title: input.title?.trim() || "New Agent Session",
    language: input.language,
    agent: input.agent,
    kind: input.kind,
    status: input.status ?? "idle",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const db = await getDatabaseClient();

  await db.execute(
    `
      INSERT INTO agent_sessions (
        id,
        user_id,
        parent_session_id,
        root_session_id,
        title,
        language,
        agent,
        kind,
        status,
        created_at,
        updated_at
      )
      VALUES (
        :id,
        :userId,
        :parentSessionId,
        :rootSessionId,
        :title,
        :language,
        :agent,
        :kind,
        :status,
        :createdAt,
        :updatedAt
      )
    `,
    {
      id: session.id,
      userId: session.userId,
      parentSessionId: session.parentSessionId,
      rootSessionId: session.rootSessionId,
      title: session.title,
      language: session.language,
      agent: session.agent,
      kind: session.kind,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }
  );

  if (input.parentSessionId) {
    await touchSession(input.parentSessionId);
  }

  return { ...session };
}

export async function getAgentSession(sessionId: string): Promise<AgentSession | null> {
  const row = await getSessionRow(sessionId);
  return row ? toAgentSession(row) : null;
}

export async function updateAgentSession(input: AgentSession): Promise<AgentSession> {
  const updated: AgentSession = {
    ...input,
    updatedAt: nowIso()
  };
  const db = await getDatabaseClient();

  await db.execute(
    `
      UPDATE agent_sessions
      SET
        user_id = :userId,
        parent_session_id = :parentSessionId,
        root_session_id = :rootSessionId,
        title = :title,
        language = :language,
        agent = :agent,
        kind = :kind,
        status = :status,
        created_at = :createdAt,
        updated_at = :updatedAt
      WHERE id = :id
    `,
    {
      id: updated.id,
      userId: updated.userId,
      parentSessionId: updated.parentSessionId,
      rootSessionId: updated.rootSessionId,
      title: updated.title,
      language: updated.language,
      agent: updated.agent,
      kind: updated.kind,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }
  );

  if (updated.parentSessionId) {
    await touchSession(updated.parentSessionId);
  }

  return { ...updated };
}

export async function updateAgentSessionTitle(
  sessionId: string,
  title: string
): Promise<AgentSession | null> {
  const session = await getAgentSession(sessionId);
  if (!session) {
    return null;
  }

  return updateAgentSession({
    ...session,
    title: title.trim() || session.title
  });
}

export async function updateAgentSessionStatus(
  sessionId: string,
  status: AgentSessionStatus
): Promise<AgentSession | null> {
  const session = await getAgentSession(sessionId);
  if (!session) {
    return null;
  }

  return updateAgentSession({
    ...session,
    status
  });
}

export async function addAgentMessage(input: {
  sessionId: string;
  role: AgentMessage["role"];
  agent: AgentMessage["agent"];
  content: string;
  parts?: AgentMessagePart[];
}): Promise<AgentMessage> {
  const message: AgentMessage = {
    id: randomUUID(),
    sessionId: input.sessionId,
    role: input.role,
    agent: input.agent,
    content: input.content,
    parts: (input.parts ?? []).map(cloneMessagePart),
    createdAt: nowIso()
  };
  const db = await getDatabaseClient();

  await db.execute(
    `
      INSERT INTO agent_messages (id, session_id, role, agent, content, parts_json, created_at)
      VALUES (:id, :sessionId, :role, :agent, :content, :partsJson, :createdAt)
    `,
    {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      agent: message.agent,
      content: message.content,
      partsJson: JSON.stringify(message.parts),
      createdAt: message.createdAt
    }
  );

  await touchSession(input.sessionId);
  return cloneMessage(message);
}

export async function updateAgentMessage(input: AgentMessage): Promise<AgentMessage | null> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      UPDATE agent_messages
      SET
        role = :role,
        agent = :agent,
        content = :content,
        parts_json = :partsJson,
        created_at = :createdAt
      WHERE id = :id AND session_id = :sessionId
    `,
    {
      id: input.id,
      sessionId: input.sessionId,
      role: input.role,
      agent: input.agent,
      content: input.content,
      partsJson: JSON.stringify(input.parts.map(cloneMessagePart)),
      createdAt: input.createdAt
    }
  );

  const row = await db.get<AgentMessageRow>(
    `
      SELECT id, session_id, role, agent, content, parts_json, created_at
      FROM agent_messages
      WHERE id = :id AND session_id = :sessionId
    `,
    {
      id: input.id,
      sessionId: input.sessionId
    }
  );

  if (!row) {
    return null;
  }

  await touchSession(input.sessionId);
  return cloneMessage(toAgentMessage(row));
}

export async function listAgentSessionSummaries(userId: string): Promise<AgentSessionSummary[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<AgentSessionRow>(
    `
      SELECT
        id,
        user_id,
        parent_session_id,
        root_session_id,
        title,
        language,
        agent,
        kind,
        status,
        created_at,
        updated_at
      FROM agent_sessions
      WHERE user_id = :userId AND parent_session_id IS NULL
      ORDER BY updated_at DESC, created_at DESC
    `,
    { userId }
  );

  return Promise.all(rows.map(toSessionSummary));
}

export async function listChildSessionSummaries(
  parentSessionId: string
): Promise<AgentSessionSummary[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<AgentSessionRow>(
    `
      SELECT
        id,
        user_id,
        parent_session_id,
        root_session_id,
        title,
        language,
        agent,
        kind,
        status,
        created_at,
        updated_at
      FROM agent_sessions
      WHERE parent_session_id = :parentSessionId
      ORDER BY created_at ASC, id ASC
    `,
    { parentSessionId }
  );

  return Promise.all(rows.map(toSessionSummary));
}

export async function buildAgentSessionDetail(sessionId: string): Promise<AgentSessionDetail | null> {
  const row = await getSessionRow(sessionId);
  if (!row) {
    return null;
  }

  const session = toAgentSession(row);
  const messages = await getMessagesForSession(sessionId);

  return {
    session,
    messages: messages.map(cloneMessage),
    children: await listChildSessionSummaries(sessionId),
    insight: buildSessionInsight(messages)
  };
}
