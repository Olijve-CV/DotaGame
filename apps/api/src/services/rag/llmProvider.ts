import { getRagConfig } from "./config.js";
import { logger } from "../../lib/logger.js";
import { buildApiUrl } from "./http.js";
import type { LlmAnswerInput, LlmAnswerOutput } from "./types.js";

function truncate(input: string, limit: number): string {
  return input.length <= limit ? input : `${input.slice(0, limit - 1)}...`;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.4;
  }
  return Math.min(0.95, Math.max(0.2, Number(value.toFixed(2))));
}

function buildFallbackAnswer(input: LlmAnswerInput): LlmAnswerOutput {
  const prefix =
    input.mode === "coach"
      ? input.language === "zh-CN"
        ? "训练建议："
        : "Coaching plan:"
      : input.language === "zh-CN"
        ? "快速结论："
        : "Quick answer:";

  const highlights = input.matches
    .slice(0, 3)
    .map((match) => truncate(match.payload.summary, 140))
    .join(" ");

  const answer =
    input.mode === "coach"
      ? `${prefix} ${highlights} ${
          input.language === "zh-CN"
            ? "建议连续 3 局记录 10 分钟补刀、死亡原因和关键道具时间点。"
            : "Track your 10-minute CS, death causes, and first core item timing for 3 matches."
        }`
      : `${prefix} ${highlights} ${
          input.language === "zh-CN"
            ? "优先按当前版本节奏和你的位置职责做决策。"
            : "Prioritize decisions by patch trends and role responsibilities."
        }`;

  return {
    answer: answer.trim(),
    confidence: clampConfidence(0.56),
    followUps:
      input.language === "zh-CN"
        ? ["要不要我按你的分路给出 3 局训练清单？", "需要我推荐当前版本稳健英雄池吗？"]
        : ["Want a 3-match drill checklist for your role?", "Need a stable hero pool recommendation?"]
  };
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

async function generateWithOpenAi(input: LlmAnswerInput, apiKey: string): Promise<LlmAnswerOutput> {
  const config = getRagConfig();
  const contextBlock = input.matches
    .slice(0, 6)
    .map(
      (match, index) =>
        `#${index + 1} ${match.payload.title}\nsource: ${match.payload.source}\nsummary: ${match.payload.summary}`
    )
    .join("\n\n");

  const systemPrompt = `You are a Dota2 coaching assistant.
Respond in ${input.language === "zh-CN" ? "Simplified Chinese" : "English"}.
Only use context for factual claims.
Return strict JSON with keys: answer(string), confidence(number 0..1), followUps(string[] length 2).`;

  const userPrompt = `mode: ${input.mode}
question: ${input.question}
player_context: ${JSON.stringify(input.context ?? {})}

knowledge_context:
${contextBlock}`;

  const response = await fetch(buildApiUrl(config.openAiBaseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OPENAI_CHAT_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("OPENAI_CHAT_EMPTY");
  }

  const jsonBlock = extractJsonObject(rawContent);
  if (!jsonBlock) {
    throw new Error("OPENAI_CHAT_NOT_JSON");
  }

  const parsed = JSON.parse(jsonBlock) as {
    answer?: string;
    confidence?: number;
    followUps?: string[];
  };

  if (!parsed.answer) {
    throw new Error("OPENAI_CHAT_MISSING_ANSWER");
  }

  const followUps = (parsed.followUps ?? []).filter(Boolean).slice(0, 2);
  while (followUps.length < 2) {
    followUps.push(
      input.language === "zh-CN"
        ? "你想优先提升对线、刷钱还是团战？"
        : "Do you want to focus on laning, farming, or teamfighting first?"
    );
  }

  return {
    answer: truncate(parsed.answer, 1200),
    confidence: clampConfidence(parsed.confidence ?? 0.6),
    followUps
  };
}

export async function generateRagAnswer(input: LlmAnswerInput): Promise<LlmAnswerOutput> {
  const config = getRagConfig();
  if (!config.openAiApiKey) {
    return buildFallbackAnswer(input);
  }

  try {
    return await generateWithOpenAi(input, config.openAiApiKey);
  } catch (error) {
    logger.warn("OpenAI chat request failed, using template fallback", {
      event: "rag.chat.fallback",
      model: config.chatModel,
      mode: input.mode,
      language: input.language,
      error
    });
    return buildFallbackAnswer(input);
  }
}
