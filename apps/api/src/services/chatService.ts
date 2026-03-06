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
  const answerByLanguage: Record<Language, string> = {
    "zh-CN":
      "I could not find a direct answer in the current index. Share your hero, role, or a specific in-game issue for more targeted help.",
    "en-US":
      "I could not find a direct answer in the current index. Share your hero, role, or a specific in-game issue for more targeted help."
  };

  return {
    answer: answerByLanguage[language],
    citations: [],
    confidence: 0.2,
    followUps: [
      "Which heroes do you play most?",
      "Are you playing solo queue or party queue?",
      "Do you want to improve laning, farming, or teamfighting?"
    ]
  };
}

export async function answerChat(request: ChatRequest): Promise<ChatResponse> {
  const knowledgeDocs = await listKnowledgeDocuments(request.language);
  const ranked = rankDocuments(request.question, knowledgeDocs).slice(0, 3);
  const patchContext = (await listPatchNotes(request.language)).slice(0, 1);

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

  const modePrefix = request.mode === "coach" ? "Coaching plan:" : "Quick answer:";
  const highlights = ranked.map((item) => item.doc.summary).join(" ");
  const answer =
    request.mode === "coach"
      ? `${modePrefix} ${highlights} Track your 10-minute CS, death causes, and first core item timing for the next 3 matches.`
      : `${modePrefix} ${highlights} Prioritize decisions using current patch trends and your role responsibilities.`;

  const rawConfidence = ranked.reduce((sum, item) => sum + item.score, 0) / (ranked.length * 8);
  const confidence = Number(Math.min(0.95, Math.max(0.35, rawConfidence)).toFixed(2));

  return {
    answer,
    citations,
    confidence,
    followUps: [
      "Want a 3-match drill checklist for your role?",
      "Do you want a stable hero pool recommendation for this patch?"
    ]
  };
}
