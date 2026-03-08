import type { AgentToolName, ChatMode, Language } from "@dotagame/contracts";
import { logger } from "../../lib/logger.js";
import { getRagConfig } from "../rag/config.js";
import { buildApiUrl } from "../rag/http.js";
import type { AgentResearchPacket } from "./agentExecutionStore.js";

export interface AgentExecutionPlan {
  summary: string;
  rationale: string;
  tools: AgentToolName[];
}

export interface AgentExecutionReplan {
  summary: string;
  rationale: string;
  nextTools: AgentToolName[];
  done: boolean;
}

function isAgentToolName(value: string): value is AgentToolName {
  return value === "knowledge_search" || value === "web_search" || value === "dota_live_search";
}

function dedupeTools(tools: AgentToolName[]): AgentToolName[] {
  const seen = new Set<AgentToolName>();
  const ordered: AgentToolName[] = [];
  for (const tool of tools) {
    if (seen.has(tool)) {
      continue;
    }
    seen.add(tool);
    ordered.push(tool);
  }
  return ordered;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function getPlannerSignals(question: string, mode: ChatMode) {
  const normalizedQuestion = question.toLowerCase();
  const needsFreshInfo = [
    "latest",
    "recent",
    "today",
    "current",
    "news",
    "patch",
    "meta",
    "tournament",
    "roster",
    "version",
    "‘o?‘-ř",
    "‘o?Š¨`",
    "„ŻS†c",
    "†«\"†%?",
    "‘-ř‚-Ż",
    "Š­ť„,?",
    "‡%^‘oŞ",
    "Šć>„§<",
    "‚~ć†r1"
  ].some((term) => normalizedQuestion.includes(term));
  const mentionsDotaSpecificTopic = [
    "dota",
    "carry",
    "support",
    "mid",
    "offlane",
    "hero",
    "lane",
    "mmr",
    "draft",
    "†>›‘^~",
    "†_1‡§¨",
    "Š<ń‚>,",
    "†^+Šú_",
    "bp",
    "†>>†?ú„«?",
    "„§\"†?ú„«?",
    "„,-†?"
  ].some((term) => normalizedQuestion.includes(term));

  return {
    needsFreshInfo,
    mentionsDotaSpecificTopic,
    mode
  };
}

function getPreferredToolSequence(input: {
  question: string;
  mode: ChatMode;
}): AgentToolName[] {
  const signals = getPlannerSignals(input.question, input.mode);
  const tools: AgentToolName[] = [];

  if (signals.mentionsDotaSpecificTopic || input.mode === "coach") {
    tools.push("knowledge_search");
  }
  if (signals.mentionsDotaSpecificTopic && signals.needsFreshInfo) {
    tools.push("dota_live_search");
  }
  if (signals.needsFreshInfo || !signals.mentionsDotaSpecificTopic) {
    tools.push("web_search");
  }
  if (tools.length === 0) {
    tools.push("knowledge_search");
  }

  return dedupeTools(tools);
}

function fallbackPlan(input: {
  question: string;
  mode: ChatMode;
  language: Language;
}): AgentExecutionPlan {
  const signals = getPlannerSignals(input.question, input.mode);
  const tools = getPreferredToolSequence(input);

  return {
    summary:
      input.language === "zh-CN"
        ? `Planner 选择 ${tools.join(" -> ")} 作为这次问题的研究顺序。`
        : `Planner selected ${tools.join(" -> ")} for this question.`,
    rationale:
      input.language === "zh-CN"
        ? signals.needsFreshInfo
          ? "问题带有时效性，需要补充最新来源。"
          : "问题更偏策略和理解，优先使用本地 Dota 知识。"
        : signals.needsFreshInfo
          ? "The question includes time-sensitive signals, so fresh sources are needed."
          : "The question is more interpretive or strategic, so local knowledge is prioritized.",
    tools
  };
}

function fallbackReplan(input: {
  question: string;
  mode: ChatMode;
  language: Language;
  completedTools: AgentToolName[];
  packets: AgentResearchPacket[];
}): AgentExecutionReplan {
  const signals = getPlannerSignals(input.question, input.mode);
  const preferredTools = getPreferredToolSequence({
    question: input.question,
    mode: input.mode
  });
  const remainingTools = preferredTools.filter((tool) => !input.completedTools.includes(tool));
  const latestPacket = input.packets[input.packets.length - 1];

  if (!latestPacket) {
    return {
      summary:
        input.language === "zh-CN"
          ? "Planner 正在选择第一个 research tool。"
          : "Planner is selecting the first research tool.",
      rationale:
        input.language === "zh-CN"
          ? "先从当前价值最高的工具开始。"
          : "Research now starts with the highest-value tool.",
      nextTools: remainingTools.slice(0, 1),
      done: remainingTools.length === 0
    };
  }

  if (!signals.needsFreshInfo && latestPacket.tool === "knowledge_search" && latestPacket.citations.length > 0) {
    return {
      summary:
        input.language === "zh-CN"
          ? "Planner 判断当前本地知识已经足够。"
          : "Planner decided the local knowledge result is sufficient.",
      rationale:
        input.language === "zh-CN"
          ? "这是偏常识/教练型问题，knowledge_search 已经覆盖核心证据。"
          : "This is an evergreen question and the local Dota knowledge already covers it.",
      nextTools: [],
      done: true
    };
  }

  if (remainingTools.length === 0) {
    return {
      summary:
        input.language === "zh-CN"
          ? "Planner 判断研究阶段已经完成。"
          : "Planner determined that evidence gathering is complete.",
      rationale:
        input.language === "zh-CN"
          ? "当前可用工具已经全部评估完。"
          : "All candidate tools have been exhausted for this turn.",
      nextTools: [],
      done: true
    };
  }

  return {
    summary:
      input.language === "zh-CN"
        ? `Planner 追加 ${remainingTools[0]} 作为下一步工具。`
        : `Planner queued ${remainingTools[0]} as the next research tool.`,
    rationale:
      input.language === "zh-CN"
        ? latestPacket.citations.length === 0
          ? "上一轮结果不够，需要继续补证。"
          : "上一轮结果有帮助，但还需要另一类证据。"
        : latestPacket.citations.length === 0
          ? "The last tool did not return enough evidence, so the planner is escalating."
          : "The last tool helped, but another evidence source is still useful.",
    nextTools: remainingTools.slice(0, 1),
    done: false
  };
}

async function planWithOpenAi(input: {
  question: string;
  mode: ChatMode;
  language: Language;
}): Promise<AgentExecutionPlan> {
  const config = getRagConfig();
  if (!config.openAiApiKey) {
    return fallbackPlan(input);
  }

  const systemPrompt = `You are a tool planner for a Dota-focused agent runtime.
Choose the minimal useful tool sequence from:
- knowledge_search: local indexed Dota knowledge
- dota_live_search: Dota live feeds from Steam and OpenDota
- web_search: general web search

Return strict JSON with keys:
- summary: string
- rationale: string
- tools: string[] using only the allowed tool names above

Rules:
- prefer the fewest tools that can answer well
- include web_search for open-web or time-sensitive questions
- include dota_live_search for Dota-specific live topics such as patches, tournaments, rosters, or meta shifts
- include knowledge_search for evergreen Dota concepts, coaching, or interpretation
- never invent tool names`;

  const userPrompt = `language: ${input.language}
mode: ${input.mode}
question: ${input.question}`;

  const response = await fetch(buildApiUrl(config.openAiBaseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OPENAI_PLANNER_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("OPENAI_PLANNER_EMPTY");
  }

  const jsonBlock = extractJsonObject(rawContent);
  if (!jsonBlock) {
    throw new Error("OPENAI_PLANNER_NOT_JSON");
  }

  const parsed = JSON.parse(jsonBlock) as {
    summary?: string;
    rationale?: string;
    tools?: string[];
  };
  const tools = dedupeTools((parsed.tools ?? []).filter(isAgentToolName));
  if (tools.length === 0) {
    throw new Error("OPENAI_PLANNER_EMPTY_TOOLS");
  }

  return {
    summary: parsed.summary?.trim() || fallbackPlan(input).summary,
    rationale: parsed.rationale?.trim() || fallbackPlan(input).rationale,
    tools
  };
}

async function replanWithOpenAi(input: {
  question: string;
  mode: ChatMode;
  language: Language;
  completedTools: AgentToolName[];
  packets: AgentResearchPacket[];
}): Promise<AgentExecutionReplan> {
  const config = getRagConfig();
  if (!config.openAiApiKey) {
    return fallbackReplan(input);
  }

  const systemPrompt = `You are a replanner for a Dota-focused agent runtime.
Choose whether more tool work is needed after the latest research results.

Allowed tools:
- knowledge_search
- dota_live_search
- web_search

Return strict JSON with keys:
- summary: string
- rationale: string
- done: boolean
- nextTools: string[] using only the allowed tool names

Rules:
- choose at most one next tool
- never repeat a completed tool
- stop when the current evidence is sufficient
- prefer fewer tools over more tools
- if the question is time-sensitive, fresh sources matter more
- if the question is evergreen coaching, stop once knowledge_search is enough`;

  const userPrompt = JSON.stringify({
    language: input.language,
    mode: input.mode,
    question: input.question,
    completedTools: input.completedTools,
    packets: input.packets.map((packet) => ({
      tool: packet.tool,
      summary: packet.summary,
      citationCount: packet.citations.length
    }))
  });

  const response = await fetch(buildApiUrl(config.openAiBaseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OPENAI_REPLANNER_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("OPENAI_REPLANNER_EMPTY");
  }

  const jsonBlock = extractJsonObject(rawContent);
  if (!jsonBlock) {
    throw new Error("OPENAI_REPLANNER_NOT_JSON");
  }

  const parsed = JSON.parse(jsonBlock) as {
    summary?: string;
    rationale?: string;
    done?: boolean;
    nextTools?: string[];
  };
  const nextTools = dedupeTools((parsed.nextTools ?? []).filter(isAgentToolName)).filter(
    (tool) => !input.completedTools.includes(tool)
  );

  return {
    summary: parsed.summary?.trim() || fallbackReplan(input).summary,
    rationale: parsed.rationale?.trim() || fallbackReplan(input).rationale,
    done: Boolean(parsed.done) || nextTools.length === 0,
    nextTools: parsed.done ? [] : nextTools.slice(0, 1)
  };
}

export async function buildAgentExecutionPlan(input: {
  question: string;
  mode: ChatMode;
  language: Language;
}): Promise<AgentExecutionPlan> {
  try {
    return await planWithOpenAi(input);
  } catch (error) {
    logger.warn("agent planner fell back to deterministic routing", {
      event: "agent.planner.fallback",
      mode: input.mode,
      language: input.language,
      error
    });
    return fallbackPlan(input);
  }
}

export async function replanAgentExecution(input: {
  question: string;
  mode: ChatMode;
  language: Language;
  completedTools: AgentToolName[];
  packets: AgentResearchPacket[];
}): Promise<AgentExecutionReplan> {
  try {
    return await replanWithOpenAi(input);
  } catch (error) {
    logger.warn("agent replanner fell back to deterministic routing", {
      event: "agent.replanner.fallback",
      mode: input.mode,
      language: input.language,
      error
    });
    return fallbackReplan(input);
  }
}
