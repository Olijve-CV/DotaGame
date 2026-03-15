import type {
  ChatCitation,
  Language,
  Tournament
} from "@dotagame/contracts";
import { listTournaments } from "../contentService.js";
import { retrieveRagContext } from "../rag/ragService.js";
import { runWebSearchSafe, type WebSearchToolInput } from "./webSearchService.js";

export interface AgentToolResult {
  summary: string;
  citations: ChatCitation[];
}

export interface LiveTournamentsToolInput {
  scope?: "ongoing" | "upcoming" | "recent";
  limit?: number;
}

function getLanguageText(language: Language) {
  if (language === "zh-CN") {
    return {
      noKnowledge: "Local knowledge search did not return strong matches.",
      noWeb: "Websearch did not return enough relevant results.",
      knowledgePrefix: "Knowledge search matched these sources:",
      webPrefix: "Websearch found these sources:",
      noLiveTournaments:
        "No tracked tournament is clearly ongoing in the current feed as of today.",
      liveTournamentPrefix: "These tracked tournaments are still ongoing as of today:",
      liveTournamentNext:
        "I can also break down any one of them by matchups, drafts, or patch trends.",
      upcomingPrefix: "These tracked tournaments are the nearest upcoming events as of today:",
      recentPrefix: "The recent tracked tournament board looks like this as of today:"
    };
  }

  return {
    noKnowledge: "The local knowledge base did not return strong matches.",
    noWeb: "Websearch did not return enough relevant results.",
    knowledgePrefix: "Knowledge search matched these sources:",
    webPrefix: "Websearch found these sources:",
    noLiveTournaments: "As of today, no tracked tournament is clearly ongoing in the current feed.",
    liveTournamentPrefix: "As of today, these tracked tournaments are still ongoing:",
    liveTournamentNext:
      "If you want, I can break down any one of them by matchups, drafts, or patch trends.",
    upcomingPrefix: "As of today, the nearest upcoming tracked tournaments are:",
    recentPrefix: "As of today, the recent tournament board looks like this:"
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

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toTournamentCitation(item: Tournament): ChatCitation {
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 5;
  }

  return Math.max(1, Math.min(8, Math.round(limit)));
}

function tournamentSortValue(item: Tournament): number {
  return new Date(`${item.startDate}T00:00:00.000Z`).getTime();
}

function isTournamentOngoing(item: Tournament, todayIso: string): boolean {
  if (item.startDate <= todayIso && item.endDate >= todayIso) {
    return true;
  }

  return item.status === "ongoing" && item.endDate >= todayIso;
}

function isTournamentUpcoming(item: Tournament, todayIso: string): boolean {
  return item.startDate > todayIso;
}

function formatTournamentLine(item: Tournament): string {
  return `- ${item.title} | ${item.startDate} - ${item.endDate} | ${item.region} | ${item.source}`;
}

export async function runLiveTournaments(
  input: LiveTournamentsToolInput,
  language: Language
): Promise<AgentToolResult> {
  const text = getLanguageText(language);
  const todayIso = getTodayIsoDate();
  const limit = normalizeLimit(input.limit);
  const scope = input.scope ?? "ongoing";
  const tournaments = await listTournaments(language);

  const ongoing = tournaments
    .filter((item) => isTournamentOngoing(item, todayIso))
    .sort((left, right) => tournamentSortValue(left) - tournamentSortValue(right))
    .slice(0, limit);

  if (scope === "ongoing") {
    if (ongoing.length === 0) {
      return {
        summary: `${text.noLiveTournaments}\nDate: ${todayIso}`,
        citations: []
      };
    }

    return {
      summary: [
        text.liveTournamentPrefix,
        `Date: ${todayIso}`,
        ...ongoing.map(formatTournamentLine),
        "",
        text.liveTournamentNext
      ].join("\n"),
      citations: ongoing.map(toTournamentCitation)
    };
  }

  if (scope === "upcoming") {
    const upcoming = tournaments
      .filter((item) => isTournamentUpcoming(item, todayIso))
      .sort((left, right) => tournamentSortValue(left) - tournamentSortValue(right))
      .slice(0, limit);

    if (upcoming.length === 0) {
      return {
        summary: `${text.upcomingPrefix}\nDate: ${todayIso}\n- None`,
        citations: []
      };
    }

    return {
      summary: [text.upcomingPrefix, `Date: ${todayIso}`, ...upcoming.map(formatTournamentLine)].join(
        "\n"
      ),
      citations: upcoming.map(toTournamentCitation)
    };
  }

  const recent = [
    ...ongoing,
    ...tournaments
      .filter((item) => !isTournamentOngoing(item, todayIso))
      .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
  ].slice(0, limit);

  if (recent.length === 0) {
    return {
      summary: `${text.recentPrefix}\nDate: ${todayIso}\n- None`,
      citations: []
    };
  }

  return {
    summary: [text.recentPrefix, `Date: ${todayIso}`, ...recent.map(formatTournamentLine)].join(
      "\n"
    ),
    citations: recent.map(toTournamentCitation)
  };
}
