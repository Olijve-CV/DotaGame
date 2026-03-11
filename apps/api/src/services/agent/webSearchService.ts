import type { ChatCitation, Language } from "@dotagame/contracts";
import { logger } from "../../lib/logger.js";
import { getRagConfig } from "../rag/config.js";

const DEFAULT_NUM_RESULTS = 8;
const DEFAULT_TIMEOUT_MS = 25_000;
const WEBSEARCH_ENDPOINT = "/mcp";

export interface WebSearchToolInput {
  query: string;
  numResults?: number;
  livecrawl?: "fallback" | "preferred";
  type?: "auto" | "fast" | "deep";
  contextMaxCharacters?: number;
}

export interface WebSearchResult {
  summary: string;
  citations: ChatCitation[];
}

interface McpSearchRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    name: "web_search_exa";
    arguments: {
      query: string;
      numResults: number;
      livecrawl: "fallback" | "preferred";
      type: "auto" | "fast" | "deep";
      contextMaxCharacters?: number;
    };
  };
}

interface McpSearchResponse {
  result?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
}

function getFallbackText(language: Language) {
  if (language === "zh-CN") {
    return {
      unavailable: "Websearch 当前不可用，因此跳过了这次工具调用。",
      noMatches: "Websearch 没有返回足够相关的结果。"
    };
  }

  return {
    unavailable: "Websearch is currently unavailable, so the tool was skipped.",
    noMatches: "Websearch did not return enough relevant results."
  };
}

function normalizeInput(input: WebSearchToolInput): WebSearchToolInput {
  const normalized: WebSearchToolInput = {
    query: input.query.trim()
  };

  if (typeof input.numResults === "number" && Number.isFinite(input.numResults)) {
    normalized.numResults = Math.max(1, Math.min(25, Math.round(input.numResults)));
  }

  if (input.livecrawl === "fallback" || input.livecrawl === "preferred") {
    normalized.livecrawl = input.livecrawl;
  }

  if (input.type === "auto" || input.type === "fast" || input.type === "deep") {
    normalized.type = input.type;
  }

  if (
    typeof input.contextMaxCharacters === "number" &&
    Number.isFinite(input.contextMaxCharacters)
  ) {
    normalized.contextMaxCharacters = Math.max(
      1_000,
      Math.min(40_000, Math.round(input.contextMaxCharacters))
    );
  }

  return normalized;
}

function toCitation(url: string, index: number): ChatCitation | null {
  try {
    const parsed = new URL(url);
    return {
      id: `websearch-${index}-${url}`,
      title: url,
      source: parsed.hostname.replace(/^www\./, ""),
      sourceUrl: url,
      publishedAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
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

function extractCitations(text: string): ChatCitation[] {
  const matches = text.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  return dedupeCitations(
    matches
      .map((url, index) => toCitation(url.replace(/[),.;]+$/, ""), index))
      .filter((citation): citation is ChatCitation => citation != null)
  ).slice(0, 6);
}

function extractTextFromPayload(payload: McpSearchResponse): string {
  const segments = (payload.result?.content ?? [])
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean);

  return segments.join("\n\n").trim();
}

function extractTextFromResponseBody(responseBody: string): string {
  const trimmed = responseBody.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{")) {
    try {
      return extractTextFromPayload(JSON.parse(trimmed) as McpSearchResponse);
    } catch {
      return "";
    }
  }

  const segments: string[] = [];
  for (const line of responseBody.split(/\r?\n/)) {
    if (!line.startsWith("data: ")) {
      continue;
    }

    const payloadText = line.slice(6).trim();
    if (!payloadText || payloadText === "[DONE]") {
      continue;
    }

    try {
      const payload = JSON.parse(payloadText) as McpSearchResponse;
      const text = extractTextFromPayload(payload);
      if (text) {
        segments.push(text);
      }
    } catch {
      continue;
    }
  }

  return segments.join("\n\n").trim();
}

export async function runWebSearch(
  input: WebSearchToolInput,
  language: Language
): Promise<WebSearchResult> {
  const config = getRagConfig();
  const text = getFallbackText(language);
  const normalized = normalizeInput(input);

  if (!normalized.query) {
    return {
      summary: text.noMatches,
      citations: []
    };
  }

  const requestBody: McpSearchRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query: normalized.query,
        numResults: normalized.numResults ?? DEFAULT_NUM_RESULTS,
        livecrawl: normalized.livecrawl ?? "fallback",
        type: normalized.type ?? "auto",
        contextMaxCharacters: normalized.contextMaxCharacters
      }
    }
  };

  const controller = new AbortController();
  const timeoutMs = Number.isFinite(config.webSearchTimeoutMs)
    ? Math.max(1_000, config.webSearchTimeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.webSearchBaseUrl}${WEBSEARCH_ENDPOINT}`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(`WEBSEARCH_FAILED:${response.status}:${responseBody.slice(0, 200)}`);
    }

    const summary = extractTextFromResponseBody(responseBody) || text.noMatches;
    return {
      summary,
      citations: extractCitations(summary)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("WEBSEARCH_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function runWebSearchSafe(
  input: WebSearchToolInput,
  language: Language
): Promise<WebSearchResult> {
  try {
    return await runWebSearch(input, language);
  } catch (error) {
    logger.warn("websearch tool failed", {
      event: "agent.tool.websearch.failed",
      queryLength: input.query.length,
      language,
      error
    });
    return {
      summary: getFallbackText(language).unavailable,
      citations: []
    };
  }
}
