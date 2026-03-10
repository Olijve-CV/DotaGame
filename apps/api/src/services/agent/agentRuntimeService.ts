import { randomUUID } from "node:crypto";
import type {
  AgentMessage,
  AgentMessagePart,
  AgentStepFinishReason,
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
  updateAgentMessage,
  updateAgentSession,
  updateAgentSessionStatus,
  updateAgentSessionTitle
} from "../../repo/agentStore.js";
import { addChatSession } from "../../repo/inMemoryStore.js";
import { logger } from "../../lib/logger.js";
import { publishAgentSessionEvent } from "./agentEventBus.js";
import { runDotaLiveSearch, runKnowledgeSearch, runWebSearch } from "./agentTools.js";
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

interface AgentStepResult {
  content: string;
  toolCalls: Array<{
    callId: string;
    tool: AgentToolName;
    input: string;
    rawArguments: string;
  }>;
}

interface ToolExecutionPacket {
  tool: AgentToolName;
  summary: string;
  citations: ChatCitation[];
}

const activeTurns = new Set<string>();
const DEFAULT_MAX_STEPS = 6;

function appendStepFinish(
  message: AgentMessage,
  step: number,
  reason: AgentStepFinishReason
): AgentMessage {
  const nextParts: AgentMessagePart[] = message.parts.filter((part) => part.type !== "step_finish");
  nextParts.push({
    type: "step_finish",
    step,
    finishedAt: new Date().toISOString(),
    reason
  });

  return {
    ...message,
    parts: nextParts
  };
}

function getCopy(language: Language) {
  if (language === "zh-CN") {
    return {
      titleFallback: "新 Agent 会话",
      toolOnly: "正在调用工具处理这个问题。",
      maxSteps: "已达到当前任务的最大步骤数。请提供更具体的后续问题。",
      fallbackAnswerTitle: "回答",
      fallbackNext: "建议下一步",
      sources: "来源"
    };
  }

  return {
    titleFallback: "New Agent Session",
    toolOnly: "Working through tool calls.",
    maxSteps: "The maximum step limit was reached. Send a narrower follow-up to continue.",
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
      ? "1. 如果你想更具体，请补充英雄、分路、段位和时间点。"
      : "1. Add your hero, lane, rank, and timing window if you want a sharper follow-up.",
    input.language === "zh-CN"
      ? "2. 继续追问某个补丁、赛事或对线细节。"
      : "2. Follow up on any patch, tournament, or matchup detail that still looks unclear."
  );

  if (citations.length > 0) {
    lines.push("", `${copy.sources}:`, summarizeCitations(citations));
  }

  return lines.join("\n");
}

function isLikelyTimeSensitive(question: string): boolean {
  return /latest|recent|current|today|right now|meta|patch|trend|tournament|赛事|最近|最新|当前|版本|补丁/i.test(
    question
  );
}

function buildFallbackToolPlan(question: string): AgentToolName[] {
  const tools: AgentToolName[] = ["knowledge_search"];
  if (isLikelyTimeSensitive(question)) {
    tools.push("dota_live_search", "web_search");
  }
  return tools;
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

async function executeTool(tool: AgentToolName, input: string, language: Language) {
  if (tool === "knowledge_search") {
    return runKnowledgeSearch(input, language);
  }
  if (tool === "dota_live_search") {
    return runDotaLiveSearch(input, language);
  }
  return runWebSearch(input, language);
}

function getToolDefinitions() {
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
        name: "dota_live_search",
        description:
          "Search recent Dota-specific live sources such as patch, tournament, and current ecosystem content.",
        parameters: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "The Dota-specific live search query."
            }
          },
          required: ["input"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the broader web for recent or open-world information when local Dota data is not enough.",
        parameters: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "The web search query."
            }
          },
          required: ["input"]
        }
      }
    }
  ] as const;
}

function buildSystemPrompt(language: Language): string {
  if (language === "zh-CN") {
    return [
      "你是 Dota 2 Agent。",
      "必要时调用工具，不要伪造来源。",
      "知识性、长期稳定的问题优先用 knowledge_search。",
      "涉及最新版本、当前赛事、最近趋势的问题可以用 dota_live_search 或 web_search。",
      "拿到足够工具结果后直接给出简洁、有根据的回答。"
    ].join("\n");
  }

  return [
    "You are a Dota 2 agent.",
    "Use tools when needed and never invent sources.",
    "Prefer knowledge_search for evergreen gameplay or historical context.",
    "Use dota_live_search or web_search for current patches, tournaments, or recent trends.",
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
      .map((call) => ({
        callId: call.id,
        tool: call.function.name,
        input: parseToolInput(call.function.arguments, ""),
        rawArguments: call.function.arguments
      }))
  };
}

function runFallbackStep(input: {
  question: string;
  language: Language;
  executedTools: AgentToolName[];
  packets: ToolExecutionPacket[];
}): AgentStepResult {
  const plan = buildFallbackToolPlan(input.question);
  const nextTool = plan.find((tool) => !input.executedTools.includes(tool));
  if (nextTool) {
    return {
      content: "",
      toolCalls: [
        {
          callId: randomUUID(),
          tool: nextTool,
          input: input.question,
          rawArguments: JSON.stringify({ input: input.question })
        }
      ]
    };
  }

  return {
    content: buildFallbackAnswer({
      question: input.question,
      language: input.language,
      packets: input.packets
    }),
    toolCalls: []
  };
}

async function decideAgentStep(input: {
  conversation: AgentConversationMessage[];
  question: string;
  language: Language;
  executedTools: AgentToolName[];
  packets: ToolExecutionPacket[];
}): Promise<AgentStepResult> {
  try {
    return await runOpenAiStep(input.conversation, input.language);
  } catch (error) {
    logger.warn("agent model step failed, using deterministic fallback", {
      event: "agent.step.fallback",
      questionLength: input.question.length,
      language: input.language,
      error
    });
    return runFallbackStep(input);
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

function findLatestAssistantAnswer(sessionId: string): string {
  const detail = buildAgentSessionDetail(sessionId);
  if (!detail) {
    return "";
  }

  for (let index = detail.messages.length - 1; index >= 0; index -= 1) {
    const message = detail.messages[index];
    if (message.role === "assistant" && message.content.trim()) {
      return message.content;
    }
  }

  return "";
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
  const executedTools: AgentToolName[] = [];
  const copy = getCopy(session.language);
  const latestUserQuestion = (() => {
    const messages = buildAgentSessionDetail(sessionId)?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        return messages[index].content;
      }
    }
    return "";
  })();

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      const assistantMessage = addAgentMessage({
        sessionId,
        role: "assistant",
        agent: "orchestrator",
        content: "",
        parts: [
          {
            type: "step_start",
            step,
            startedAt: new Date().toISOString()
          }
        ]
      });
      publishRoot(sessionId);

      const stepResult = await decideAgentStep({
        conversation,
        question: latestUserQuestion,
        language: session.language,
        executedTools,
        packets
      });

      let currentAssistant = {
        ...assistantMessage,
        content:
          stepResult.content.trim() ||
          (stepResult.toolCalls.length > 0 ? copy.toolOnly : assistantMessage.content)
      };

      if (stepResult.toolCalls.length === 0) {
        currentAssistant = appendStepFinish(currentAssistant, step, "completed");
        updateAgentMessage(currentAssistant);
        updateAgentSessionStatus(sessionId, "completed");
        publishRoot(sessionId);

        const finalAnswer = currentAssistant.content.trim() || buildFallbackAnswer({
          question: latestUserQuestion,
          language: session.language,
          packets
        });

        if (finalAnswer !== currentAssistant.content) {
          currentAssistant = {
            ...currentAssistant,
            content: finalAnswer
          };
          updateAgentMessage(currentAssistant);
          publishRoot(sessionId);
        }

        if (session.userId) {
          addChatSession({
            userId: session.userId,
            question: latestUserQuestion,
            answer: finalAnswer,
            mode: "coach",
            language: session.language
          });
        }

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
        return;
      }

      const toolParts: AgentMessagePart[] = stepResult.toolCalls.map((toolCall) => ({
        type: "tool_call" as const,
        callId: toolCall.callId,
        tool: toolCall.tool,
        status: "running" as const,
        inputSummary: toolCall.input || latestUserQuestion,
        outputSummary: "",
        citations: []
      }));

      currentAssistant = {
        ...currentAssistant,
        parts: [...currentAssistant.parts, ...toolParts]
      };
      updateAgentMessage(currentAssistant);
      publishRoot(sessionId);

      const openAiToolCalls: OpenAiToolCall[] = stepResult.toolCalls.map((toolCall) => ({
        id: toolCall.callId,
        type: "function",
        function: {
          name: toolCall.tool,
          arguments: toolCall.rawArguments
        }
      }));

      conversation.push({
        role: "assistant",
        content: stepResult.content,
        tool_calls: openAiToolCalls
      });

      for (const toolCall of stepResult.toolCalls) {
        try {
          const result = await executeTool(
            toolCall.tool,
            toolCall.input || latestUserQuestion,
            session.language
          );

          packets.push({
            tool: toolCall.tool,
            summary: result.summary,
            citations: result.citations
          });
          executedTools.push(toolCall.tool);

          currentAssistant = {
            ...currentAssistant,
            parts: currentAssistant.parts.map((part) =>
              part.type === "tool_call" && part.callId === toolCall.callId
                ? {
                    ...part,
                    status: "completed",
                    outputSummary: result.summary,
                    citations: result.citations
                  }
                : part
            )
          };
          updateAgentMessage(currentAssistant);
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
          currentAssistant = {
            ...currentAssistant,
            parts: currentAssistant.parts.map((part) =>
              part.type === "tool_call" && part.callId === toolCall.callId
                ? {
                    ...part,
                    status: "failed",
                    outputSummary: message,
                    citations: []
                  }
                : part
            )
          };
          updateAgentMessage(currentAssistant);
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

      currentAssistant = appendStepFinish(currentAssistant, step, "tool_calls");
      updateAgentMessage(currentAssistant);
      publishRoot(sessionId);
    }

    const lastAssistantAnswer = findLatestAssistantAnswer(sessionId);
    addAgentMessage({
      sessionId,
      role: "assistant",
      agent: "orchestrator",
      content: lastAssistantAnswer || copy.maxSteps,
      parts: [
        {
          type: "step_start",
          step: maxSteps + 1,
          startedAt: new Date().toISOString()
        },
        {
          type: "step_finish",
          step: maxSteps + 1,
          finishedAt: new Date().toISOString(),
          reason: "max_steps"
        }
      ]
    });
    updateAgentSessionStatus(sessionId, "completed");
    publishRoot(sessionId);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SESSION_FAILED";
    updateAgentSessionStatus(sessionId, "failed");
    addAgentMessage({
      sessionId,
      role: "assistant",
      agent: "orchestrator",
      content: message,
      parts: [
        {
          type: "step_start",
          step: 0,
          startedAt: new Date().toISOString()
        },
        {
          type: "step_finish",
          step: 0,
          finishedAt: new Date().toISOString(),
          reason: "failed"
        }
      ]
    });
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

  publishRoot(input.sessionId);
  startSessionTurn(input.sessionId);

  const detail = buildAgentSessionDetail(input.sessionId);
  if (!detail) {
    throw new Error("SESSION_NOT_FOUND");
  }
  return detail;
}
