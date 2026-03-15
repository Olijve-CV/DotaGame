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
import {
  runLiveTournaments,
  runWebSearch,
  type LiveTournamentsToolInput
} from "./agentTools.js";
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
  liveTournamentsInput: LiveTournamentsToolInput | null;
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

function isLiveTournamentScope(value: unknown): value is LiveTournamentsToolInput["scope"] {
  return value === "ongoing" || value === "upcoming" || value === "recent";
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

async function publishDetailEvent(sessionId: string): Promise<void> {
  const detail = await buildAgentSessionDetail(sessionId);
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

async function publishRoot(sessionId: string): Promise<void> {
  const session = await getAgentSession(sessionId);
  if (!session) {
    return;
  }

  await publishDetailEvent(session.rootSessionId);
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

async function buildConversationSeed(sessionId: string): Promise<AgentConversationMessage[]> {
  const detail = await buildAgentSessionDetail(sessionId);
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

function normalizeLiveTournamentsInput(
  input: LiveTournamentsToolInput
): LiveTournamentsToolInput {
  return {
    scope: isLiveTournamentScope(input.scope) ? input.scope : undefined,
    limit:
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.max(1, Math.min(8, Math.round(input.limit)))
        : undefined
  };
}

function parseLiveTournamentsInput(rawArguments: string): LiveTournamentsToolInput {
  try {
    const parsed = JSON.parse(rawArguments) as {
      scope?: string;
      limit?: number;
    };

    return {
      scope: isLiveTournamentScope(parsed.scope) ? parsed.scope : undefined,
      limit: parsed.limit
    };
  } catch {
    return {};
  }
}

function buildToolCacheKey(
  tool: AgentToolName,
  input: string,
  webSearchInput?: WebSearchToolInput | null,
  liveTournamentsInput?: LiveTournamentsToolInput | null
): string {
  if (tool === "live_tournaments") {
    return `${tool}:${JSON.stringify(normalizeLiveTournamentsInput(liveTournamentsInput ?? {}))}`;
  }

  if (tool !== "websearch") {
    return `${tool}:${normalizeToolInput(input)}`;
  }

  return `${tool}:${JSON.stringify(normalizeWebSearchInput(webSearchInput ?? { query: input }))}`;
}

async function shouldSetSessionTitle(sessionId: string): Promise<boolean> {
  const detail = await buildAgentSessionDetail(sessionId);
  if (!detail) {
    return true;
  }

  return !detail.messages.some((message) => message.role === "user");
}

async function executeTool(
  tool: AgentToolName,
  input: string,
  language: Language,
  webSearchInput?: WebSearchToolInput | null,
  liveTournamentsInput?: LiveTournamentsToolInput | null
) {
  if (tool === "live_tournaments") {
    return runLiveTournaments(liveTournamentsInput ?? {}, language);
  }

  return runWebSearch(webSearchInput ?? { query: input }, language);
}

function getToolDefinitions() {
  const currentYear = new Date().getFullYear();
  const todayIso = new Date().toISOString().slice(0, 10);

  return [
    {
      type: "function",
      function: {
        name: "live_tournaments",
        description:
          `Return structured Dota 2 tournament tracking from the app's synced content store. Today is ${todayIso}. Use this first when the user asks which tournaments are ongoing, live, current, today, or upcoming.`,
        parameters: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["ongoing", "upcoming", "recent"],
              description:
                "Use 'ongoing' for currently running events, 'upcoming' for next scheduled events, and 'recent' for a mixed recent board."
            },
            limit: {
              type: "number",
              description: "Maximum number of tournaments to return. Default is 5."
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "websearch",
        description:
          `Search the web using Exa-style real-time web search for both evergreen and recent Dota information. The current year is ${currentYear}; include it when searching for recent information.`,
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
  const currentYear = new Date().getFullYear();

  if (language === "zh-CN") {
    return [
      "你是一个专注于 Dota 2 的学习与分析型 agent。",
      "你的目标是同时服务两类需求：1）帮助新手和普通玩家了解并学习 Dota 2；2）帮助进阶玩家深度分析英雄、对线、节奏、出装、阵容、版本变化、职业比赛和战术趋势。",
      "默认先给结论，再给依据；既要说清楚“是什么”，也要说清楚“为什么”和“怎么用”。",
      "回答要具体、可执行、可验证，避免空泛套话。",
      "先判断用户更像是在要：入门教学、英雄学习、上分复盘、版本理解、赛事分析，还是职业级战术拆解；如果信息不足，就根据提问方式自行推断，不要为了小事频繁反问。",
      "根据问题类型和用户水平自适应回答深度：新手问题先解释概念和术语，再给简单例子；进阶问题提供更细的机制、时机点、决策逻辑和取舍；高分局或职业分析要强调样本、阵容逻辑、地图资源交换、关键时间点和执行细节。",
      "当同一个问题同时适合面向新手和高手回答时，优先使用“基础理解 / 进阶分析”这样的双层结构，让不同层次的用户都能读懂。",
      "做教学时，语言要易懂，避免默认用户知道黑话；必要时先解释术语，再给一到三个最重要的行动建议或练习重点。",
      "如果用户在问单个英雄、英雄池或英雄玩法，优先按这个结构回答：一句话结论、英雄定位、强势期与节奏、技能/出装/天赋思路、对线与团战要点、克制关系与常见失误。",
      "如果用户在问比赛、战队、选手、版本趋势或职业赛场现象，优先按这个结构回答：结论、版本与背景、BP/阵容逻辑、关键回合与执行、这说明了什么趋势。",
      "如果用户在问自己的问题、上分困境、复盘或某局为什么输，优先按这个结构回答：核心问题、对线阶段、中期节奏、团战与地图决策、下一把最该改的 1 到 3 点。",
      "英雄分析优先覆盖：定位、强势期、关键技能联动、出装/天赋思路、对线要点、团战职责、克制与被克制、常见失误。",
      "复盘或上分建议优先覆盖：对线、节奏、地图行动、资源分配、视野、团战站位、关键误判，以及下一把最值得修正的点。",
      "赛事或版本分析优先覆盖：版本背景、样本来源、队伍/选手风格、BP思路、战术执行、结果背后的原因，并区分事实和推断。",
      "当前 runtime 只提供 websearch 这一个工具；需要查证时统一使用 websearch。",
      "无论是常青玩法、英雄理解、历史背景，还是当前版本、近期赛事、职业趋势和公开互联网内容，都使用 websearch，但要优先选择高质量来源并控制结论强度。",
      `当用户问“最新”“当前”“今天”“最近”之类问题时，把 ${currentYear} 年写进搜索词，并优先确认具体日期、版本号、赛事阶段或时间范围。`,
      "不要编造来源、战绩、版本内容或赛事信息；证据不足时明确说明不确定点。",
      "如果现有信息足够，就直接作答；只有在缺少关键上下文且会显著影响结论时，才简短指出还需要哪些信息。",
      "输出保持简洁清楚；当问题适合深度分析时，使用有层次的小标题或分段。",
      "除非用户明确只要简短回答，否则尽量在结尾给出下一步：可以是练习重点、观察指标、复盘框架，或值得继续追问的方向。"
    ].join("\n");
  }

  return [
    "You are a Dota 2 learning and analysis agent.",
    "Your job is to serve both beginner learning and advanced analysis: help newer players understand Dota 2, and help experienced players deeply analyze heroes, lanes, tempo, itemization, drafts, patches, pro matches, and meta trends.",
    "Lead with the conclusion, then explain the evidence; cover both what is happening and why it matters.",
    "Keep answers concrete, actionable, and verifiable. Avoid vague filler.",
    "First infer whether the user wants beginner teaching, hero learning, ranked improvement, patch understanding, tournament analysis, or pro-level tactical breakdown. Do not ask clarifying questions unless the missing context would materially change the answer.",
    "Adapt depth to the user: explain fundamentals and jargon for beginners, provide finer mechanics, timing windows, decision logic, and tradeoffs for advanced users, and emphasize sample quality, draft logic, map trades, timing windows, and execution detail for high-level or pro analysis.",
    "When a topic benefits both beginners and advanced players, prefer a layered answer such as Basics and Advanced View so both audiences get value.",
    "When teaching, use simple language first, define important terms, and give one to three practical actions or drills.",
    "If the user is asking about a hero, hero pool, or how to play a hero, prefer this structure: one-line conclusion, role, power spikes and tempo, skill-item-talent logic, lane and teamfight plan, counters and common mistakes.",
    "If the user is asking about matches, teams, players, patch trends, or pro-level patterns, prefer this structure: conclusion, patch and context, draft logic, key moments and execution, and what trend this reveals.",
    "If the user is asking for self-review, ranked improvement, or why a game went wrong, prefer this structure: core issue, lane phase, midgame tempo, teamfight and map decisions, and the top 1 to 3 fixes for the next game.",
    "For hero analysis, prioritize role, power spikes, key spell interactions, item and talent logic, lane plan, teamfight job, counters, and common mistakes.",
    "For ranked improvement or review questions, prioritize lane play, tempo, map movement, farm allocation, vision, teamfight positioning, critical mistakes, and the highest-value adjustment for the next game.",
    "For tournament or patch analysis, prioritize patch context, evidence quality, team or player style, draft logic, execution details, and clearly separate facts from inference.",
    "The current runtime exposes only websearch. Use websearch for all evidence gathering.",
    "Use websearch for both evergreen gameplay knowledge and current patches, recent tournaments, open-web content, and live meta developments, while favoring high-quality sources and calibrated conclusions.",
    `When the user asks for recent information, include the current year ${currentYear} in the search query and verify exact dates, patch numbers, event stages, or time windows when relevant.`,
    "Never invent sources, stats, patch notes, or match details. If evidence is thin, say what is uncertain.",
    "Answer directly when the available context is sufficient; only ask for missing context when it would materially change the analysis.",
    "Stay concise by default, but use structured sections when the question benefits from deeper analysis.",
    "Unless the user explicitly wants a very short answer, end with the most useful next step: a practice focus, review checklist, metric to watch, or a strong follow-up question."
  ].join("\n");
}

function buildAgentSystemPrompt(language: Language): string {
  const currentYear = new Date().getFullYear();
  const todayIso = new Date().toISOString().slice(0, 10);

  if (language === "zh-CN") {
    return [
      "你是一个专注于 Dota 2 的学习与分析型 agent。",
      "默认先给结论，再给依据；回答要具体、可执行、可验证。",
      `今天的日期是 ${todayIso}。`,
      "当用户问当前、今天、现在、正在举办、ongoing、live、upcoming 一类赛事问题时，优先使用 live_tournaments 工具。",
      "只有在 live_tournaments 不能覆盖用户问题时，才补充使用 websearch。",
      "不要把已经结束的赛事说成正在进行。只有当今天日期落在 startDate 到 endDate 之间，或工具明确返回 ongoing，才可以说赛事正在进行。",
      `当用户问最近信息时，把 ${currentYear} 写入搜索词，并核对具体日期、版本号、赛事阶段或时间范围。`,
      "不要编造来源、战绩、版本内容或赛事信息；证据不足时明确说明不确定点。",
      "如果用户在问比赛、队伍、选手、版本趋势或职业现象，优先给：结论、背景、BP/阵容逻辑、关键执行、趋势含义。",
      "保持回答简洁清楚；必要时使用小标题。"
    ].join("\n");
  }

  return [
    "You are a Dota 2 learning and analysis agent.",
    "Lead with the conclusion, then explain the evidence.",
    "Keep answers concrete, actionable, and verifiable. Avoid vague filler.",
    `Today is ${todayIso}.`,
    "Use live_tournaments first when the user asks which tournaments are ongoing, live, current, today, or upcoming.",
    "Only use websearch to supplement tournament answers when live_tournaments is insufficient.",
    "Do not call an event ongoing unless today's date falls inside its date window or the tool output clearly marks it ongoing.",
    `When the user asks for recent information, include the current year ${currentYear} in the search query and verify exact dates, patch numbers, event stages, or time windows.`,
    "Never invent sources, stats, patch notes, or match details. If evidence is thin, say what is uncertain.",
    "For tournament or patch analysis, prioritize patch context, evidence quality, team or player style, draft logic, execution details, and clearly separate facts from inference.",
    "Stay concise by default, but use structured sections when the question benefits from deeper analysis."
  ].join("\n");
}

function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function parseRetryAfterMilliseconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }

  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function getOpenAiRetryDelayMs(response: Response, attempt: number): number {
  const headerDelayMs = parseRetryAfterMilliseconds(response.headers.get("retry-after"));
  if (headerDelayMs !== null) {
    return headerDelayMs;
  }

  return Math.min(1000 * 2 ** (attempt - 1), 5000);
}

async function runOpenAiStep(
  conversation: AgentConversationMessage[],
  language: Language
): Promise<AgentStepResult> {
  const config = getRagConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }

  const url = buildApiUrl(config.openAiBaseUrl, "/chat/completions");
  const body = JSON.stringify({
    model: config.chatModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: buildAgentSystemPrompt(language)
      },
      ...conversation
    ],
    tools: getToolDefinitions(),
    tool_choice: "auto"
  });

  let response: Response | null = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body
    });

    if (response.ok) {
      break;
    }

    if (response.status !== 429 || attempt === maxAttempts) {
      throw new Error(`OPENAI_AGENT_FAILED:${response.status}`);
    }

    const delayMs = getOpenAiRetryDelayMs(response, attempt);
    logger.warn("openai agent request rate limited; retrying", {
      event: "agent.openai.retry",
      attempt,
      maxAttempts,
      delayMs,
      status: response.status
    });
    await waitForDelay(delayMs);
  }

  if (!response?.ok) {
    throw new Error(`OPENAI_AGENT_FAILED:${response?.status ?? 500}`);
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
        const liveTournamentsInput =
          call.function.name === "live_tournaments"
            ? parseLiveTournamentsInput(call.function.arguments)
            : null;

        return {
          callId: call.id,
          tool: call.function.name,
          input:
            call.function.name === "websearch"
              ? webSearchInput?.query ?? ""
              : call.function.name === "live_tournaments"
                ? ""
                : parseToolInput(call.function.arguments, ""),
          rawArguments: call.function.arguments,
          webSearchInput,
          liveTournamentsInput
        };
      })
  };
}

function hasToolConversationMessage(
  conversation: AgentConversationMessage[],
  tool: AgentToolName
): boolean {
  return conversation.some((message) => {
    if (message.role !== "tool") {
      return false;
    }

    return message.content.includes(`"tool":"${tool}"`);
  });
}

function shouldForceLiveTournamentLookup(
  question: string,
  conversation: AgentConversationMessage[]
): boolean {
  if (hasToolConversationMessage(conversation, "live_tournaments")) {
    return false;
  }

  const normalized = question.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const asksAboutTournaments =
    /tournament|event|schedule|bracket|赛事|比赛|赛程|对阵/.test(normalized);
  const asksAboutCurrentStatus =
    /ongoing|live|current|today|right now|now|happening|running|正在|当前|现在|今天|举办中|进行中/.test(
      normalized
    );
  const asksForAnalysisInstead =
    /meta|draft|support|carry|hero|ban|pick|bp|trend|打法|体系|阵容|英雄|版本/.test(normalized);

  return asksAboutTournaments && asksAboutCurrentStatus && !asksForAnalysisInstead;
}

function buildForcedLiveTournamentStep(question: string): AgentStepResult {
  const scope: LiveTournamentsToolInput["scope"] = /upcoming|即将|接下来/.test(question.toLowerCase())
    ? "upcoming"
    : "ongoing";

  return {
    content: "",
    toolCalls: [
      {
        callId: `forced-live-tournaments-${Date.now()}`,
        tool: "live_tournaments",
        input: "",
        rawArguments: JSON.stringify({ scope, limit: 5 }),
        webSearchInput: null,
        liveTournamentsInput: {
          scope,
          limit: 5
        }
      }
    ]
  };
}

async function decideAgentStep(input: {
  conversation: AgentConversationMessage[];
  question: string;
  language: Language;
}): Promise<AgentStepResult> {
  if (shouldForceLiveTournamentLookup(input.question, input.conversation)) {
    return buildForcedLiveTournamentStep(input.question);
  }

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

async function getLatestUserQuestion(sessionId: string): Promise<string> {
  const messages = (await buildAgentSessionDetail(sessionId))?.messages ?? [];
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

async function publishSessionCompleted(sessionId: string): Promise<void> {
  const completedDetail = await buildAgentSessionDetail(sessionId);
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

  const session = await getAgentSession(sessionId);
  if (!session) {
    return;
  }

  activeTurns.add(sessionId);
  const maxSteps = Number(process.env.AGENT_MAX_STEPS ?? DEFAULT_MAX_STEPS);
  const conversation = await buildConversationSeed(sessionId);
  const packets: ToolExecutionPacket[] = [];
  const toolResultCache = new Map<string, ToolExecutionPacket>();
  const copy = getCopy(session.language);
  const latestUserQuestion = await getLatestUserQuestion(sessionId);

  let assistantMessage = await addAgentMessage({
    sessionId,
    role: "assistant",
    agent: "orchestrator",
    content: "",
    parts: upsertThinkingPart([], {
      status: "running",
      summary: copy.thinking
    })
  });
  await publishRoot(sessionId);

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
        await updateAgentMessage(assistantMessage);
        await updateAgentSessionStatus(sessionId, "completed");
        await publishRoot(sessionId);

        if (session.userId) {
          await addChatSession({
            userId: session.userId,
            question: latestUserQuestion,
            answer: finalAnswer,
            mode: "coach",
            language: session.language
          });
        }

        await publishSessionCompleted(sessionId);
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
      await updateAgentMessage(assistantMessage);
      await publishRoot(sessionId);

      const openAiToolCalls: OpenAiToolCall[] = stepResult.toolCalls.map(buildOpenAiToolCall);

      conversation.push({
        role: "assistant",
        content: stepResult.content,
        tool_calls: openAiToolCalls
      });

      for (const toolCall of stepResult.toolCalls) {
        const toolInput = toolCall.input || latestUserQuestion;
        const cacheKey = buildToolCacheKey(
          toolCall.tool,
          toolInput,
          toolCall.webSearchInput,
          toolCall.liveTournamentsInput
        );
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
                toolCall.webSearchInput,
                toolCall.liveTournamentsInput
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
          await updateAgentMessage(assistantMessage);
          await publishRoot(sessionId);

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
          await updateAgentMessage(assistantMessage);
          await publishRoot(sessionId);

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
    await updateAgentMessage(assistantMessage);
    await updateAgentSessionStatus(sessionId, "completed");
    await publishRoot(sessionId);

    await publishSessionCompleted(sessionId);
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
    await updateAgentMessage(assistantMessage);
    await updateAgentSessionStatus(sessionId, "failed");
    await publishRoot(sessionId);

    publishAgentSessionEvent({
      type: "session.failed",
      sessionId,
      rootSessionId: session.rootSessionId,
      detail: (await buildAgentSessionDetail(sessionId)) ?? undefined,
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
}): Promise<AgentSession> {
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

export function getSessionDetail(sessionId: string): Promise<AgentSessionDetail | null> {
  return buildAgentSessionDetail(sessionId);
}

export function listSessions(userId: string): Promise<AgentSessionSummary[]> {
  return listAgentSessionSummaries(userId);
}

export function listChildren(sessionId: string): Promise<AgentSessionSummary[]> {
  return listChildSessionSummaries(sessionId);
}

export async function sendMessageToSession(input: {
  sessionId: string;
  userId: string | null;
  message: string;
  language: Language;
}): Promise<AgentSessionDetail> {
  const session = await getAgentSession(input.sessionId);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }
  if (!input.userId) {
    throw new Error("UNAUTHORIZED");
  }
  if (session.userId !== input.userId) {
    throw new Error("FORBIDDEN");
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

  await updateAgentSession({
    ...session,
    language: input.language,
    status: "running"
  });
  if (await shouldSetSessionTitle(input.sessionId)) {
    await updateAgentSessionTitle(input.sessionId, buildSessionTitle(trimmedMessage, input.language));
  }

  await addAgentMessage({
    sessionId: input.sessionId,
    role: "user",
    agent: null,
    content: trimmedMessage,
    parts: [{ type: "text", text: trimmedMessage }]
  });

  await publishRoot(input.sessionId);
  startSessionTurn(input.sessionId);

  const detail = await buildAgentSessionDetail(input.sessionId);
  if (!detail) {
    throw new Error("SESSION_NOT_FOUND");
  }
  return detail;
}
