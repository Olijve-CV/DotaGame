import type { ChatCitation, Language, Tournament } from "@dotagame/contracts";
import type { Article, PatchNote } from "@dotagame/contracts";
import { listArticles, listPatchNotes, listTournaments } from "../contentService.js";
import { retrieveRagContext } from "../rag/ragService.js";
import { runOpenAiWebSearchSafe } from "./openAiWebSearchService.js";

export interface AgentToolResult {
  summary: string;
  citations: ChatCitation[];
}

function getLanguageText(language: Language) {
  if (language === "zh-CN") {
    return {
      noKnowledge: "知识库里没有找到足够直接的匹配内容。",
      noWeb: "通用全网搜索没有返回足够相关的结果。",
      noDotaLive: "Dota 实时源没有找到足够相关的近期资料。",
      knowledgePrefix: "知识库命中了这些线索：",
      webPrefix: "通用全网搜索检索到这些来源：",
      dotaLivePrefix: "Dota 实时源检索到这些近期来源："
    };
  }

  return {
    noKnowledge: "The local knowledge base did not return strong matches.",
    noWeb: "General web search did not return enough relevant results.",
    noDotaLive: "The Dota live-source tool did not return enough recent matches.",
    knowledgePrefix: "Knowledge search matched these sources:",
    webPrefix: "General web search found these sources:",
    dotaLivePrefix: "Dota live search found these recent sources:"
  };
}

function summarizeCitations(prefix: string, citations: ChatCitation[]): string {
  const bulletList = citations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation.title} (${citation.source})`)
    .join("\n");
  return `${prefix}\n${bulletList}`;
}

function buildSearchTerms(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter((term) => term.length >= 2);
}

function scoreItem(
  item: Pick<Article, "title" | "summary" | "tags"> | Pick<PatchNote, "title" | "summary" | "tags">,
  terms: string[]
): number {
  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const tags = item.tags.map((tag) => tag.toLowerCase());

  return terms.reduce((total, term) => {
    if (title.includes(term)) {
      return total + 4;
    }
    if (summary.includes(term)) {
      return total + 2;
    }
    if (tags.some((tag) => tag.includes(term))) {
      return total + 1;
    }
    return total;
  }, 0);
}

function toCitation(item: Article | PatchNote | Tournament): ChatCitation {
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt
  };
}

export async function runKnowledgeSearch(
  question: string,
  language: Language
): Promise<AgentToolResult> {
  const text = getLanguageText(language);
  const context = await retrieveRagContext({
    question,
    language,
    limit: 4
  });

  if (context.citations.length === 0) {
    return {
      summary: text.noKnowledge,
      citations: []
    };
  }

  return {
    summary: summarizeCitations(text.knowledgePrefix, context.citations),
    citations: context.citations
  };
}

export async function runWebSearch(
  question: string,
  language: Language
): Promise<AgentToolResult> {
  const text = getLanguageText(language);
  const result = await runOpenAiWebSearchSafe(question, language);

  if (result.citations.length === 0) {
    return {
      summary: result.summary || text.noWeb,
      citations: []
    };
  }

  return {
    summary: result.summary.startsWith(text.noWeb)
      ? summarizeCitations(text.webPrefix, result.citations)
      : result.summary,
    citations: result.citations
  };
}

export async function runDotaLiveSearch(
  question: string,
  language: Language
): Promise<AgentToolResult> {
  const text = getLanguageText(language);
  const terms = buildSearchTerms(question);
  const [articles, patchNotes, tournaments] = await Promise.all([
    listArticles({ language, query: question }),
    listPatchNotes(language),
    listTournaments(language)
  ]);

  const matches = [
    ...articles.map((item) => ({ item, score: scoreItem(item, terms) })),
    ...patchNotes.map((item) => ({ item, score: scoreItem(item, terms) })),
    ...tournaments.map((item) => ({ item, score: scoreItem(item, terms) }))
  ]
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.item.publishedAt).getTime() - new Date(a.item.publishedAt).getTime()
    )
    .slice(0, 4);

  const citations = matches.map((entry) => toCitation(entry.item));
  if (citations.length === 0) {
    return {
      summary: text.noDotaLive,
      citations: []
    };
  }

  return {
    summary: summarizeCitations(text.dotaLivePrefix, citations),
    citations
  };
}
