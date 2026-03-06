import type { Article, ChatRequest, ChatResponse, Language } from "@dotagame/contracts";
import { listKnowledgeDocuments, listPatchNotes } from "./contentService.js";

interface RankedDoc {
  doc: Article;
  score: number;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function rankDocuments(question: string, docs: Article[]): RankedDoc[] {
  const questionTokens = new Set(tokenize(question));

  return docs
    .map((doc) => {
      const docTokens = tokenize(`${doc.title} ${doc.summary} ${doc.tags.join(" ")}`);
      const score = docTokens.reduce((sum, token) => sum + (questionTokens.has(token) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildFallback(language: Language): ChatResponse {
  if (language === "zh-CN") {
    return {
      answer:
        "我暂时没有在知识库中找到直接答案。你可以补充英雄、分路或你遇到的具体对局场景，我会给出更有针对性的建议。",
      citations: [],
      confidence: 0.2,
      followUps: [
        "你当前常玩的英雄是哪些？",
        "你是单排还是五排？",
        "你最想提升的是对线、刷钱还是团战？"
      ]
    };
  }

  return {
    answer:
      "I could not find a direct answer from the current knowledge base. Share your hero, role, or a concrete match issue and I can give focused guidance.",
    citations: [],
    confidence: 0.2,
    followUps: [
      "Which heroes do you play most?",
      "Are you playing solo queue or party?",
      "Do you want to improve laning, farming, or teamfighting?"
    ]
  };
}

export function answerChat(request: ChatRequest): ChatResponse {
  const knowledgeDocs = listKnowledgeDocuments(request.language);
  const ranked = rankDocuments(request.question, knowledgeDocs).slice(0, 3);
  const patchContext = listPatchNotes(request.language).slice(0, 1);

  if (ranked.length === 0) {
    return buildFallback(request.language);
  }

  const citationDocs = [...ranked.map((item) => item.doc), ...patchContext];
  const citations = citationDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
    publishedAt: doc.publishedAt
  }));

  const modePrefix =
    request.language === "zh-CN"
      ? request.mode === "coach"
        ? "训练建议："
        : "快速结论："
      : request.mode === "coach"
        ? "Coaching plan:"
        : "Quick answer:";

  const highlights = ranked.map((item) => item.doc.summary).join(" ");
  const answer =
    request.language === "zh-CN"
      ? `${modePrefix} ${highlights} ${
          request.mode === "coach"
            ? "建议你接下来连续 3 局记录 10 分钟补刀、死亡原因和参团时机，再按结果微调英雄池。"
            : "优先根据当前版本补丁和你的位置职责做决策。"
        }`
      : `${modePrefix} ${highlights} ${
          request.mode === "coach"
            ? "Track your 10-minute CS, deaths, and first major item timing for the next 3 matches, then adjust your hero pool."
            : "Prioritize decisions around patch trends and your role responsibility."
        }`;

  const rawConfidence = ranked.reduce((sum, item) => sum + item.score, 0) / (ranked.length * 8);
  const confidence = Number(Math.min(0.95, Math.max(0.35, rawConfidence)).toFixed(2));

  const followUps =
    request.language === "zh-CN"
      ? ["要不要我按你的分路给出 3 局训练清单？", "需要我推荐当前版本的稳健英雄池吗？"]
      : [
          "Want a 3-match drill checklist for your role?",
          "Do you want a stable hero pool recommendation for this patch?"
        ];

  return {
    answer,
    citations,
    confidence,
    followUps
  };
}
