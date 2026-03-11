import type { ChatCitation, Language } from "@dotagame/contracts";
import { retrieveRagContext } from "../rag/ragService.js";
import { runWebSearchSafe, type WebSearchToolInput } from "./webSearchService.js";

export interface AgentToolResult {
  summary: string;
  citations: ChatCitation[];
}

function getLanguageText(language: Language) {
  if (language === "zh-CN") {
    return {
      noKnowledge: "本地知识库没有返回足够强的匹配结果。",
      noWeb: "Websearch 没有返回足够相关的结果。",
      knowledgePrefix: "知识库检索命中了这些来源：",
      webPrefix: "Websearch 找到了这些来源："
    };
  }

  return {
    noKnowledge: "The local knowledge base did not return strong matches.",
    noWeb: "Websearch did not return enough relevant results.",
    knowledgePrefix: "Knowledge search matched these sources:",
    webPrefix: "Websearch found these sources:"
  };
}

function summarizeCitations(prefix: string, citations: ChatCitation[]): string {
  const bulletList = citations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation.title} (${citation.source})`)
    .join("\n");
  return `${prefix}\n${bulletList}`;
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
  input: WebSearchToolInput,
  language: Language
): Promise<AgentToolResult> {
  const text = getLanguageText(language);
  const result = await runWebSearchSafe(input, language);

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
