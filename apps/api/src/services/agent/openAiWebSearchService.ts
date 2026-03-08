import type { ChatCitation, Language } from "@dotagame/contracts";
import { logger } from "../../lib/logger.js";
import { getRagConfig } from "../rag/config.js";
import { buildApiUrl } from "../rag/http.js";

export interface OpenAiWebSearchResult {
  summary: string;
  citations: ChatCitation[];
}

interface OpenAiWebSearchSource {
  title?: string;
  url?: string;
}

function getFallbackText(language: Language) {
  if (language === "zh-CN") {
    return {
      unavailable: "通用全网搜索当前不可用，已跳过该工具。",
      noMatches: "通用全网搜索没有返回足够相关的结果。"
    };
  }

  return {
    unavailable: "General web search is currently unavailable, so the tool was skipped.",
    noMatches: "General web search did not return enough relevant results."
  };
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
    result.push(citation);
  }
  return result;
}

function toCitation(source: OpenAiWebSearchSource, index: number): ChatCitation | null {
  if (!source.url) {
    return null;
  }

  const hostname = (() => {
    try {
      return new URL(source.url).hostname.replace(/^www\./, "");
    } catch {
      return "web";
    }
  })();

  return {
    id: `web-${index}-${source.url}`,
    title: source.title?.trim() || source.url,
    source: hostname,
    sourceUrl: source.url,
    publishedAt: new Date().toISOString()
  };
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return "";
}

function extractSources(payload: {
  output?: Array<{
    type?: string;
    action?: { sources?: OpenAiWebSearchSource[] };
    content?: Array<{
      annotations?: Array<{
        type?: string;
        title?: string;
        url?: string;
      }>;
    }>;
  }>;
}): ChatCitation[] {
  const sourceCandidates: OpenAiWebSearchSource[] = [];

  for (const item of payload.output ?? []) {
    if (item.type === "web_search_call") {
      sourceCandidates.push(...(item.action?.sources ?? []));
    }

    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (!annotation.url) {
          continue;
        }
        sourceCandidates.push({
          title: annotation.title,
          url: annotation.url
        });
      }
    }
  }

  return dedupeCitations(
    sourceCandidates
      .map((source, index) => toCitation(source, index))
      .filter((citation): citation is ChatCitation => citation != null)
  );
}

function buildUserLocation(config: ReturnType<typeof getRagConfig>) {
  if (
    !config.webSearchCountry &&
    !config.webSearchCity &&
    !config.webSearchRegion &&
    !config.webSearchTimezone
  ) {
    return undefined;
  }

  return {
    type: "approximate" as const,
    country: config.webSearchCountry,
    city: config.webSearchCity,
    region: config.webSearchRegion,
    timezone: config.webSearchTimezone
  };
}

export async function runOpenAiWebSearch(
  question: string,
  language: Language
): Promise<OpenAiWebSearchResult> {
  const config = getRagConfig();
  const text = getFallbackText(language);

  if (!config.openAiApiKey) {
    return {
      summary: text.unavailable,
      citations: []
    };
  }

  const response = await fetch(buildApiUrl(config.openAiBaseUrl, "/responses"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.webSearchModel,
      input:
        language === "zh-CN"
          ? `请执行通用全网搜索并简要总结这个问题：${question}`
          : `Search the open web and summarize this question: ${question}`,
      tools: [
        {
          type: "web_search",
          user_location: buildUserLocation(config)
        }
      ],
      include: ["web_search_call.action.sources"]
    })
  });

  if (!response.ok) {
    throw new Error(`OPENAI_WEB_SEARCH_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      action?: { sources?: OpenAiWebSearchSource[] };
      content?: Array<{
        type?: string;
        text?: string;
        annotations?: Array<{
          type?: string;
          title?: string;
          url?: string;
        }>;
      }>;
    }>;
  };

  const summary = extractOutputText(payload);
  const citations = extractSources(payload).slice(0, 6);

  if (!summary && citations.length === 0) {
    return {
      summary: text.noMatches,
      citations: []
    };
  }

  return {
    summary: summary || text.noMatches,
    citations
  };
}

export async function runOpenAiWebSearchSafe(
  question: string,
  language: Language
): Promise<OpenAiWebSearchResult> {
  try {
    return await runOpenAiWebSearch(question, language);
  } catch (error) {
    logger.warn("general web search tool failed", {
      event: "agent.tool.web_search.failed",
      questionLength: question.length,
      language,
      error
    });
    return {
      summary: getFallbackText(language).unavailable,
      citations: []
    };
  }
}
