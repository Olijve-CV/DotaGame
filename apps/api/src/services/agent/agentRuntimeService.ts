import type {
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionSummary,
  AgentThinkingPart,
  AgentToolName,
  AgentToolCallPart,
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
  updateAgentMessage,
  updateAgentSession,
  updateAgentSessionStatus,
  updateAgentSessionTitle
} from "../../repo/agentStore.js";
import { addChatSession } from "../../repo/inMemoryStore.js";
import { logger } from "../../lib/logger.js";
import { publishAgentSessionEvent } from "./agentEventBus.js";
import { runKnowledgeSearch, runWebSearch } from "./agentTools.js";
import type { WebSearchToolInput } from "./webSearchService.js";
import { getRagConfig } from "../rag/config.js";
import { buildApiUrl } from "../rag/http.js";

type AgentConversationMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
      tool_calls?: OpenAiToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: {
    name: AgentToolName;
    arguments: string;
  };
}

interface AgentToolCallRequest {
  callId: string;
  tool: AgentToolName;
  input: string;
  rawArguments: string;
  webSearchInput: WebSearchToolInput | null;
}

interface AgentStepResult {
  content: string;
  toolCalls: AgentToolCallRequest[];
}

interface ToolExecutionPacket {
  tool: AgentToolName;
  summary: string;
  citations: ChatCitation[];
}

function isWebSearchType(value: unknown): value is WebSearchToolInput["type"] {
  return value === "auto" || value === "fast" || value === "deep";
}

function isWebSearchLivecrawl(value: unknown): value is WebSearchToolInput["livecrawl"] {
  return value === "fallback" || value === "preferred";
}

const activeTurns = new Set<string>();
const DEFAULT_MAX_STEPS = 6;

function upsertThinkingPart(
  parts: AgentMessagePart[],
  input: Pick<AgentThinkingPart, "status" | "summary">
): AgentMessagePart[] {
  const nextThinking: AgentThinkingPart = {
    type: "thinking",
    status: input.status,
    summary: input.summary
  };

  return [nextThinking, ...parts.filter((part) => part.type !== "thinking")];
}

function getCopy(language: Language) {
  if (language === "zh-CN") {
    return {
      titleFallback: "新的智能体会话",
      thinking: "正在思考你的问题。",
      thinkingWithTools: "正在检索信息并整理结论。",
      thinkingDone: "已完成推理并生成结论。",
      thinkingFailed: "本轮智能体执行失败。",
      maxSteps: "已达到当前推理上限，请缩小问题范围后继续。",
      fallbackAnswerTitle: "回答",
      fallbackNext: "建议下一步",
      sources: "来源"
    };
  }

  return {
    titleFallback: "New Agent Session",
    thinking: "Thinking through the request.",
    thinkingWithTools: "Gathering evidence and working through tool calls.",
    thinkingDone: "Reasoning complete.",
    thinkingFailed: "The agent run failed.",
    maxSteps: "The agent hit its current reasoning limit. Send a narrower follow-up to continue.",
    fallbackAnswerTitle: "Answer",
    fallbackNext: "Suggested next steps",
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

function getReusedToolMessage(language: Language): string {
  return language === "zh-CN"
    ? "复用了本轮里相同工具查询的已有结果。"
    : "Reused the earlier result for the same tool query.";
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

function publishRoot(sessionId: string): void {
  const session = getAgentSession(sessionId);
  if (!session) {
    return;
  }

  publishDetailEvent(session.rootSessionId);
}

function dedupeCitations(citations: ChatCitation[]): ChatCitation[] {
  const seen = new Set<string>();
  const result: ChatCitation[] = [];
  for (const citation of citations) {
    const key = `${citation.sourceUrl}:${citation.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ ...citation });
  }
  return result;
}

function summarizeCitations(citations: ChatCitation[]): string {
  return citations
    .slice(0, 4)
    .map((citation, index) => `${index + 1}. ${citation.title} (${citation.source})`)
    .join("\n");
}

function buildFallbackAnswer(input: {
  question: string;
  language: Language;
  packets: ToolExecutionPacket[];
}): string {
  const copy = getCopy(input.language);
  const citations = dedupeCitations(input.packets.flatMap((packet) => packet.citations));
  const lines: string[] = [`${copy.fallbackAnswerTitle}: ${input.question}`];

  for (const packet of input.packets) {
    if (!packet.summary) {
      continue;
    }
    lines.push("", packet.summary);
  }

  lines.push(
    "",
    `${copy.fallbackNext}:`,
    input.language === "zh-CN"
      ? "1. 补充你的英雄、分路、分段和关键时间点，我可以给出更具体的判断。"
      : "1. Add your hero, lane, rank, and timing window if you want a sharper follow-up.",
    input.language === "zh-CN"
      ? "2. 继续追问某个补丁、赛事或对局细节，我可以把问题拆得更具体。"
      : "2. Follow up on any patch, tournament, or matchup detail that still looks unclear."
  );

  if (citations.length > 0) {
    lines.push("", `${copy.sources}:`, summarizeCitations(citations));
  }

  return lines.join("\n");
}

function buildHistoryAssistantContent(content: string, packets: ToolExecutionPacket[]): string {
  const sections = [content.trim()].filter(Boolean);
  for (const packet of packets) {
    const lines = [`Tool ${packet.tool}:`, packet.summary];
    if (packet.citations.length > 0) {
      lines.push(summarizeCitations(packet.citations));
    }
    sections.push(lines.filter(Boolean).join("\n"));
  }
  return sections.join("\n\n").trim();
}

function buildConversationSeed(sessionId: string): AgentConversationMessage[] {
  const detail = buildAgentSessionDetail(sessionId);
  if (!detail) {
    return [];
  }

  const conversation: AgentConversationMessage[] = [];
  for (const message of detail.messages) {
    if (message.role === "user") {
      conversation.push({
        role: "user",
        content: message.content
      });
      continue;
    }

    if (message.role === "assistant") {
      const packets: ToolExecutionPacket[] = message.parts
        .filter((part): part is Extract<typeof part, { type: "tool_call" }> => part.type === "tool_call")
        .filter((part) => part.status === "completed" && part.outputSummary.trim().length > 0)
        .map((part) => ({
          tool: part.tool,
          summary: part.outputSummary,
          citations: part.citations
        }));

      const content = buildHistoryAssistantContent(message.content, packets);
      if (content) {
        conversation.push({
          role: "assistant",
          content
        });
      }
    }
  }

  return conversation;
}

function parseToolInput(rawArguments: string, fallbackInput: string): string {
  try {
    const parsed = JSON.parse(rawArguments) as {
      input?: string;
      query?: string;
      question?: string;
    };
    return parsed.input?.trim() || parsed.query?.trim() || parsed.question?.trim() || fallbackInput;
  } catch {
    return fallbackInput;
  }
}

function normalizeToolInput(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeWebSearchInput(input: WebSearchToolInput): WebSearchToolInput {
  return {
    query: normalizeToolInput(input.query),
    numResults:
      typeof input.numResults === "number" && Number.isFinite(input.numResults)
        ? Math.max(1, Math.min(25, Math.round(input.numResults)))
        : undefined,
    livecrawl: isWebSearchLivecrawl(input.livecrawl) ? input.livecrawl : undefined,
    type: isWebSearchType(input.type) ? input.type : undefined,
    contextMaxCharacters:
      typeof input.contextMaxCharacters === "number" && Number.isFinite(input.contextMaxCharacters)
        ? Math.max(1_000, Math.min(40_000, Math.round(input.contextMaxCharacters)))
        : undefined
  };
}

function parseWebSearchInput(rawArguments: string, fallbackInput: string): WebSearchToolInput {
  try {
    const parsed = JSON.parse(rawArguments) as {
      query?: string;
      input?: string;
      question?: string;
      numResults?: number;
      livecrawl?: string;
      type?: string;
      contextMaxCharacters?: number;
    };

    return {
      query: parsed.query?.trim() || parsed.input?.trim() || parsed.question?.trim() || fallbackInput,
      numResults: parsed.numResults,
      livecrawl: isWebSearchLivecrawl(parsed.livecrawl) ? parsed.livecrawl : undefined,
      type: isWebSearchType(parsed.type) ? parsed.type : undefined,
      contextMaxCharacters: parsed.contextMaxCharacters
    };
  } catch {
    return {
      query: fallbackInput
    };
  }
}

function buildToolCacheKey(
  tool: AgentToolName,
  input: string,
  webSearchInput?: WebSearchToolInput | null
): string {
  if (tool !== "websearch") {
    return `${tool}:${normalizeToolInput(input)}`;
  }

  return `${tool}:${JSON.stringify(normalizeWebSearchInput(webSearchInput ?? { query: input }))}`;
}

function shouldSetSessionTitle(sessionId: string): boolean {
  const detail = buildAgentSessionDetail(sessionId);
  if (!detail) {
    return true;
  }

  return !detail.messages.some((message) => message.role === "user");
}

async function executeTool(
  tool: AgentToolName,
  input: string,
  language: Language,
  webSearchInput?: WebSearchToolInput | null
) {
  if (tool === "knowledge_search") {
    return runKnowledgeSearch(input, language);
  }
  return runWebSearch(webSearchInput ?? { query: input }, language);
}

function getToolDefinitions() {
  const currentYear = new Date().getFullYear();

  return [
    {
      type: "function",
      function: {
        name: "knowledge_search",
        description:
          "Search the local Dota knowledge base for evergreen gameplay, role, and historical product context.",
        parameters: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "The search query to send to the knowledge search tool."
            }
          },
          required: ["input"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "websearch",
        description:
          `Search the web using Exa-style real-time web search. The current year is ${currentYear}; include it when searching for recent information.`,
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Websearch query."
            },
            numResults: {
              type: "number",
              description: "Number of search results to return. Default is 8."
            },
            livecrawl: {
              type: "string",
              enum: ["fallback", "preferred"],
              description: "Live crawl mode. Use 'fallback' by default or 'preferred' for fresher crawling."
            },
            type: {
              type: "string",
              enum: ["auto", "fast", "deep"],
              description: "Search mode. Use 'auto' by default, 'fast' for speed, or 'deep' for broader coverage."
            },
            contextMaxCharacters: {
              type: "number",
              description: "Maximum characters to return for LLM-oriented context."
            }
          },
          required: ["query"]
        }
      }
    }
  ] as const;
}

function buildSystemPrompt(language: Language): string {
  if (language === "zh-CN") {
    return [
      "你是一个 Dota 2 agent。",
      "按需使用工具，并且不要编造来源。",
      "常青玩法、英雄理解、历史背景优先使用 knowledge_search。",
      "涉及近期信息、开放互联网内容或最新动态时，使用 websearch。",
      "当用户问“最新”“当前”“今天”之类问题时，把 2026 年写进搜索词。",
      "一旦拿到足够证据，直接给出简洁回答。"
    ].join("\n");

    return [
      "你是一个 Dota 2 智能体。",
      "需要时使用工具，不要编造来源。",
      "常识性玩法、历史背景、长期有效的信息优先用 knowledge_search。",
      "当前版本、赛事、近期趋势优先考虑 dota_live_search 或 web_search。",
      "有足够证据后，直接给出清晰结论。"
    ].join("\n");
  }

  return [
    "You are a Dota 2 agent.",
    "Use tools when needed and never invent sources.",
    "Prefer knowledge_search for evergreen gameplay or historical context.",
    "Use websearch for current or open-web information.",
    "When the user asks for recent information, include the current year 2026 in the search query.",
    "Once you have enough tool evidence, answer directly and concisely."
  ].join("\n");
}

async function runOpenAiStep(
  conversation: AgentConversationMessage[],
  language: Language
): Promise<AgentStepResult> {
  const config = getRagConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }

  const response = await fetch(buildApiUrl(config.openAiBaseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(language)
        },
        ...conversation
      ],
      tools: getToolDefinitions(),
      tool_choice: "auto"
    })
  });

  if (!response.ok) {
    throw new Error(`OPENAI_AGENT_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: OpenAiToolCall[];
      };
    }>;
  };

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error("OPENAI_AGENT_EMPTY");
  }

  return {
    content: typeof message.content === "string" ? message.content.trim() : "",
    toolCalls: (message.tool_calls ?? [])
      .filter((call) => call.type === "function")
      .map((call) => {
        const webSearchInput =
          call.function.name === "websearch"
            ? parseWebSearchInput(call.function.arguments, "")
            : null;

        return {
          callId: call.id,
          tool: call.function.name,
          input:
            call.function.name === "websearch"
              ? webSearchInput?.query ?? ""
              : parseToolInput(call.function.arguments, ""),
          rawArguments: call.function.arguments,
          webSearchInput
        };
      })
  };
}

async function decideAgentStep(input: {
  conversation: AgentConversationMessage[];
  question: string;
  language: Language;
}): Promise<AgentStepResult> {
  try {
    return await runOpenAiStep(input.conversation, input.language);
  } catch (error) {
    logger.error("agent model step failed", {
      event: "agent.step.failed",
      questionLength: input.question.length,
      language: input.language,
      error
    });
    throw error;
  }
}

function buildToolConversationPayload(packet: ToolExecutionPacket): string {
  return JSON.stringify({
    tool: packet.tool,
    summary: packet.summary,
    citations: packet.citations.map((citation) => ({
      title: citation.title,
      source: citation.source,
      url: citation.sourceUrl
    }))
  });
}

function getLatestUserQuestion(sessionId: string): string {
  const messages = buildAgentSessionDetail(sessionId)?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index].content;
    }
  }
  return "";
}

function buildRunningToolPart(
  toolCall: AgentToolCallRequest,
  latestUserQuestion: string
): AgentToolCallPart {
  return {
    type: "tool_call",
    callId: toolCall.callId,
    tool: toolCall.tool,
    status: "running",
    inputSummary: toolCall.input || latestUserQuestion,
    outputSummary: "",
    citations: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null
  };
}

function buildOpenAiToolCall(toolCall: AgentToolCallRequest): OpenAiToolCall {
  return {
    id: toolCall.callId,
    type: "function",
    function: {
      name: toolCall.tool,
      arguments: toolCall.rawArguments
    }
  };
}

function getToolStartedAt(parts: AgentMessagePart[], callId: string): string {
  const toolPart = parts.find(
    (part): part is AgentToolCallPart => part.type === "tool_call" && part.callId === callId
  );

  return toolPart?.startedAt ?? new Date().toISOString();
}

function getDurationMs(startedAt: string, completedAt: string): number {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function updateToolCallPart(
  message: AgentMessage,
  callId: string,
  patch: Pick<
    AgentToolCallPart,
    "status" | "outputSummary" | "citations" | "completedAt" | "durationMs"
  >
): AgentMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === "tool_call" && part.callId === callId
        ? {
            ...part,
            ...patch
          }
        : part
    )
  };
}

function publishSessionCompleted(sessionId: string): void {
  const completedDetail = buildAgentSessionDetail(sessionId);
  if (!completedDetail) {
    return;
  }

  publishAgentSessionEvent({
    type: "session.completed",
    sessionId,
    rootSessionId: completedDetail.session.rootSessionId,
    detail: completedDetail,
    timestamp: new Date().toISOString()
  });
}

async function runSessionTurn(sessionId: string): Promise<void> {
  if (activeTurns.has(sessionId)) {
    return;
  }

  const session = getAgentSession(sessionId);
  if (!session) {
    return;
  }

  activeTurns.add(sessionId);
  const maxSteps = Number(process.env.AGENT_MAX_STEPS ?? DEFAULT_MAX_STEPS);
  const conversation = buildConversationSeed(sessionId);
  const packets: ToolExecutionPacket[] = [];
  const toolResultCache = new Map<string, ToolExecutionPacket>();
  const copy = getCopy(session.language);
  const latestUserQuestion = getLatestUserQuestion(sessionId);

  let assistantMessage = addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: "",
    parts: upsertThinkingPart([], {
      status: "running",
      summary: copy.thinking
    })
  });
  publishRoot(sessionId);

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      const stepResult = await decideAgentStep({
        conversation,
        question: latestUserQuestion,
        language: session.language
      });

      if (stepResult.toolCalls.length === 0) {
        const finalAnswer = stepResult.content.trim() || buildFallbackAnswer({
          question: latestUserQuestion,
          language: session.language,
          packets
        });

        assistantMessage = {
          ...assistantMessage,
          content: finalAnswer,
          parts: upsertThinkingPart(assistantMessage.parts, {
            status: "completed",
            summary: copy.thinkingDone
          })
        };
        updateAgentMessage(assistantMessage);
        updateAgentSessionStatus(sessionId, "completed");
        publishRoot(sessionId);

        if (session.userId) {
          addChatSession({
            userId: session.userId,
            question: latestUserQuestion,
            answer: finalAnswer,
            mode: "coach",
            language: session.language
          });
        }

        publishSessionCompleted(sessionId);
        return;
      }

      const toolParts: AgentMessagePart[] = stepResult.toolCalls.map((toolCall) =>
        buildRunningToolPart(toolCall, latestUserQuestion)
      );

      assistantMessage = {
        ...assistantMessage,
        parts: upsertThinkingPart(
          [...assistantMessage.parts.filter((part) => part.type !== "thinking"), ...toolParts],
          {
            status: "running",
            summary: copy.thinkingWithTools
          }
        )
      };
      updateAgentMessage(assistantMessage);
      publishRoot(sessionId);

      const openAiToolCalls: OpenAiToolCall[] = stepResult.toolCalls.map(buildOpenAiToolCall);

      conversation.push({
        role: "assistant",
        content: stepResult.content,
        tool_calls: openAiToolCalls
      });

      for (const toolCall of stepResult.toolCalls) {
        const toolInput = toolCall.input || latestUserQuestion;
        const cacheKey = buildToolCacheKey(toolCall.tool, toolInput, toolCall.webSearchInput);
        const toolStartedAt = getToolStartedAt(assistantMessage.parts, toolCall.callId);

        try {
          const cachedPacket = toolResultCache.get(cacheKey);
          const result = cachedPacket
            ? {
                summary: `${getReusedToolMessage(session.language)}\n${cachedPacket.summary}`.trim(),
                citations: cachedPacket.citations
              }
            : await executeTool(
                toolCall.tool,
                toolInput,
                session.language,
                toolCall.webSearchInput
              );

          if (!cachedPacket) {
            const freshPacket = {
              tool: toolCall.tool,
              summary: result.summary,
              citations: result.citations
            };
            packets.push(freshPacket);
            toolResultCache.set(cacheKey, freshPacket);
          }

          const completedAt = new Date().toISOString();
          const durationMs = getDurationMs(toolStartedAt, completedAt);

          assistantMessage = updateToolCallPart(assistantMessage, toolCall.callId, {
            status: "completed",
            outputSummary: result.summary,
            citations: result.citations,
            completedAt,
            durationMs
          });
          updateAgentMessage(assistantMessage);
          publishRoot(sessionId);

          conversation.push({
            role: "tool",
            tool_call_id: toolCall.callId,
            content: buildToolConversationPayload({
              tool: toolCall.tool,
              summary: result.summary,
              citations: result.citations
            })
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "TOOL_FAILED";
          const completedAt = new Date().toISOString();
          const durationMs = getDurationMs(toolStartedAt, completedAt);
          assistantMessage = updateToolCallPart(assistantMessage, toolCall.callId, {
            status: "failed",
            outputSummary: message,
            citations: [],
            completedAt,
            durationMs
          });
          updateAgentMessage(assistantMessage);
          publishRoot(sessionId);

          conversation.push({
            role: "tool",
            tool_call_id: toolCall.callId,
            content: JSON.stringify({
              tool: toolCall.tool,
              error: message
            })
          });
        }
      }
    }

    assistantMessage = {
      ...assistantMessage,
      content: assistantMessage.content.trim() || copy.maxSteps,
      parts: upsertThinkingPart(assistantMessage.parts, {
        status: "completed",
        summary: copy.maxSteps
      })
    };
    updateAgentMessage(assistantMessage);
    updateAgentSessionStatus(sessionId, "completed");
    publishRoot(sessionId);

    publishSessionCompleted(sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SESSION_FAILED";
    assistantMessage = {
      ...assistantMessage,
      content: message,
      parts: upsertThinkingPart(assistantMessage.parts, {
        status: "failed",
        summary: copy.thinkingFailed
      })
    };
    updateAgentMessage(assistantMessage);
    updateAgentSessionStatus(sessionId, "failed");
    publishRoot(sessionId);

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
}): AgentSession {
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

export function getSessionDetail(sessionId: string): AgentSessionDetail | null {
  return buildAgentSessionDetail(sessionId);
}

export function listSessions(userId: string): AgentSessionSummary[] {
  return listAgentSessionSummaries(userId);
}

export function listChildren(sessionId: string): AgentSessionSummary[] {
  return listChildSessionSummaries(sessionId);
}

export async function sendMessageToSession(input: {
  sessionId: string;
  userId: string | null;
  message: string;
  language: Language;
}): Promise<AgentSessionDetail> {
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

  updateAgentSession({
    ...session,
    language: input.language,
    status: "running"
  });
  if (shouldSetSessionTitle(input.sessionId)) {
    updateAgentSessionTitle(input.sessionId, buildSessionTitle(trimmedMessage, input.language));
  }

  addAgentMessage({
    sessionId: input.sessionId,
    role: "user",
    agent: null,
    content: trimmedMessage,
    parts: [{ type: "text", text: trimmedMessage }]
  });

  publishRoot(input.sessionId);
  startSessionTurn(input.sessionId);

  const detail = buildAgentSessionDetail(input.sessionId);
  if (!detail) {
    throw new Error("SESSION_NOT_FOUND");
  }
  return detail;
}
