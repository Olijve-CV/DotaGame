import type { Article, Language, PatchNote } from "@dotagame/contracts";
import { withCache } from "./cache.js";

const OFFICIAL_NEWS_EVENTS_URL = "https://store.steampowered.com/events/ajaxgetpartnereventspageable/";
const OFFICIAL_NEWS_BASE_URL = "https://www.dota2.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const NEWS_EVENT_TYPES = new Set([13, 14, 21, 26, 28, 35]);
const UPDATE_EVENT_TYPES = new Set([12]);

interface OfficialNewsResponse {
  events?: OfficialNewsEvent[];
}

interface OfficialNewsEvent {
  gid?: string | number;
  GID?: string | number;
  event_type?: number;
  type?: number;
  event_name?: string;
  name?: string;
  title?: string;
  rtime32_start_time?: number;
  rtime_start_time?: number;
  rtime_start?: number;
  start_time?: number;
  announcement_body?: {
    headline?: string;
    body?: string;
    tags?: string[];
  };
  jsondata?: {
    localized_summary?: string[];
    summary?: string;
    subtitle?: string;
    localized_subtitle?: string[];
    patch_notes?: boolean;
  };
  tags?: string[];
}

function liveSourcesEnabled(): boolean {
  if (process.env.USE_LIVE_SOURCES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function toOfficialLanguage(language: Language): string {
  return language === "zh-CN" ? "schinese" : "english";
}

function stripHtml(input: string): string {
  return input
    .replace(/\[\/?(?:h1|h2|h3|b|i|u|img|url|quote|list|\*)[^\]]*\]/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{STEAM_CLAN_IMAGE\}\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEventId(event: OfficialNewsEvent): string | null {
  const value = event.gid ?? event.GID;
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function getEventType(event: OfficialNewsEvent): number {
  return event.event_type ?? event.type ?? 0;
}

function getPublishedAt(event: OfficialNewsEvent): string {
  const timestamp =
    event.rtime32_start_time ??
    event.rtime_start_time ??
    event.rtime_start ??
    event.start_time ??
    Math.floor(Date.now() / 1000);
  return new Date(timestamp * 1000).toISOString();
}

function getTitle(event: OfficialNewsEvent, language: Language): string {
  return (
    event.announcement_body?.headline ??
    event.event_name ??
    event.name ??
    event.title ??
    (language === "zh-CN" ? "Dota 2 官方消息" : "Dota 2 Official Update")
  );
}

function getSummary(event: OfficialNewsEvent, language: Language): string {
  const localizedSummary = event.jsondata?.localized_summary?.find((value) => value?.trim().length);
  const localizedSubtitle = event.jsondata?.localized_subtitle?.find((value) => value?.trim().length);
  const rawSummary =
    localizedSummary ??
    event.jsondata?.summary ??
    localizedSubtitle ??
    event.jsondata?.subtitle ??
    event.announcement_body?.body ??
    "";
  const summary = stripHtml(rawSummary).slice(0, 260);

  if (summary.length > 0) {
    return summary;
  }

  return language === "zh-CN" ? "来自 Dota 2 官方新闻页的最新消息。" : "Latest update from the Dota 2 official news page.";
}

function getTags(event: OfficialNewsEvent): string[] {
  const tags = [...(event.announcement_body?.tags ?? []), ...(event.tags ?? [])]
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

function detectCategory(event: OfficialNewsEvent): Article["category"] {
  const eventType = getEventType(event);
  if (UPDATE_EVENT_TYPES.has(eventType) || event.jsondata?.patch_notes) {
    return "patch";
  }

  if (NEWS_EVENT_TYPES.has(eventType)) {
    const corpus = `${getTitle(event, "en-US")} ${getSummary(event, "en-US")}`.toLowerCase();
    if (/(international|qualifier|tournament|league|major|championship|cup)/.test(corpus)) {
      return "tournament";
    }
    return "news";
  }

  return "news";
}

function toArticle(event: OfficialNewsEvent, language: Language): Article | null {
  const eventId = getEventId(event);
  const eventType = getEventType(event);
  if (!eventId || (!NEWS_EVENT_TYPES.has(eventType) && !UPDATE_EVENT_TYPES.has(eventType))) {
    return null;
  }

  return {
    id: `dota-news-${eventId}-${language}`,
    category: detectCategory(event),
    language,
    source: language === "zh-CN" ? "Dota2 官方" : "Dota2 Official",
    sourceUrl: `${OFFICIAL_NEWS_BASE_URL}/newsentry/${eventId}`,
    title: getTitle(event, language),
    summary: getSummary(event, language),
    tags: getTags(event),
    publishedAt: getPublishedAt(event)
  };
}

function extractVersion(title: string): string {
  const match = title.match(/\b\d+\.\d+[a-z]?\b/i);
  return match?.[0] ?? "unknown";
}

function toPatchNote(event: OfficialNewsEvent, language: Language): PatchNote | null {
  const eventId = getEventId(event);
  const eventType = getEventType(event);
  if (!eventId || !UPDATE_EVENT_TYPES.has(eventType)) {
    return null;
  }

  const title = getTitle(event, language);
  return {
    id: `dota-patch-${eventId}-${language}`,
    version: extractVersion(title),
    language,
    source: language === "zh-CN" ? "Dota2 官方" : "Dota2 Official",
    sourceUrl: `${OFFICIAL_NEWS_BASE_URL}/newsentry/${eventId}`,
    title,
    summary: getSummary(event, language),
    tags: [...new Set([...getTags(event), "patchnotes"])],
    publishedAt: getPublishedAt(event)
  };
}

async function fetchOfficialNewsEvents(language: Language): Promise<OfficialNewsEvent[]> {
  if (!liveSourcesEnabled()) {
    return [];
  }

  return withCache(`dota-news-events-${language}`, CACHE_TTL_MS, async () => {
    const params = new URLSearchParams({
      appid: "570",
      offset: "0",
      count: "100",
      l: toOfficialLanguage(language),
      origin: OFFICIAL_NEWS_BASE_URL
    });

    const response = await fetch(`${OFFICIAL_NEWS_EVENTS_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`DOTA_OFFICIAL_NEWS_FAILED:${response.status}`);
    }

    const data = (await response.json()) as OfficialNewsResponse;
    return data.events ?? [];
  });
}

export async function fetchSteamArticles(language: Language): Promise<Article[]> {
  const events = await fetchOfficialNewsEvents(language);
  return events
    .map((event) => toArticle(event, language))
    .filter((item): item is Article => Boolean(item))
    .filter((item) => item.category !== "patch");
}

export async function fetchSteamPatchNotes(language: Language): Promise<PatchNote[]> {
  const events = await fetchOfficialNewsEvents(language);
  return events
    .map((event) => toPatchNote(event, language))
    .filter((item): item is PatchNote => Boolean(item));
}
