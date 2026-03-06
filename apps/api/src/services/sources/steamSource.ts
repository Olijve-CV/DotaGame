import type { Article, Language, PatchNote } from "@dotagame/contracts";
import { withCache } from "./cache.js";

const STEAM_NEWS_URL =
  "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=30&maxlength=420&format=json";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SteamNewsApiResponse {
  appnews?: {
    newsitems?: SteamNewsItem[];
  };
}

interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  contents: string;
  date: number;
  appid?: number;
  feedname?: string;
  tags?: string[];
}

function liveSourcesEnabled(): boolean {
  if (process.env.USE_LIVE_SOURCES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function stripHtml(input: string): string {
  return input
    .replace(/\{STEAM_CLAN_IMAGE\}\/\S+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(item: SteamNewsItem): Article["category"] {
  const corpus = `${item.title} ${item.contents}`.toLowerCase();
  if (/(patch|gameplay update|update - \d{1,2}\/\d{1,2}\/\d{4})/.test(corpus)) {
    return "patch";
  }
  if (/(international|qualifier|tournament|league|major|championship|cup)/.test(corpus)) {
    return "tournament";
  }
  return "news";
}

function toArticle(item: SteamNewsItem, language: Language): Article {
  const rawSummary = stripHtml(item.contents).slice(0, 260);
  const summary =
    rawSummary.length > 0
      ? rawSummary
      : language === "zh-CN"
        ? "Dota2 official announcement in English."
        : "Dota2 official announcement.";

  return {
    id: `steam-news-${item.gid}-${language}`,
    category: detectCategory(item),
    language,
    source: "Dota2 Official (Steam)",
    sourceUrl: item.url,
    title: item.title,
    summary,
    tags: item.tags ?? [],
    publishedAt: new Date(item.date * 1000).toISOString()
  };
}

function extractVersion(title: string): string {
  const match = title.match(/\b\d+\.\d+[a-z]?\b/i);
  return match?.[0] ?? "unknown";
}

function toPatchNote(item: SteamNewsItem, language: Language): PatchNote {
  const summary = stripHtml(item.contents).slice(0, 260) || "Official gameplay update.";
  return {
    id: `steam-patch-${item.gid}-${language}`,
    version: extractVersion(item.title),
    language,
    source: "Dota2 Official (Steam)",
    sourceUrl: item.url,
    title: item.title,
    summary,
    tags: item.tags ?? ["patchnotes"],
    publishedAt: new Date(item.date * 1000).toISOString()
  };
}

async function fetchRawSteamNews(): Promise<SteamNewsItem[]> {
  if (!liveSourcesEnabled()) {
    return [];
  }

  return withCache("steam-news-raw", CACHE_TTL_MS, async () => {
    const response = await fetch(STEAM_NEWS_URL);
    if (!response.ok) {
      throw new Error(`STEAM_NEWS_FAILED:${response.status}`);
    }

    const data = (await response.json()) as SteamNewsApiResponse;
    const items = data.appnews?.newsitems ?? [];
    return items.filter((item) => item.appid === 570 && item.feedname === "steam_community_announcements");
  });
}

export async function fetchSteamArticles(language: Language): Promise<Article[]> {
  const rawItems = await fetchRawSteamNews();
  return rawItems.map((item) => toArticle(item, language));
}

export async function fetchSteamPatchNotes(language: Language): Promise<PatchNote[]> {
  const rawItems = await fetchRawSteamNews();
  return rawItems
    .filter((item) => detectCategory(item) === "patch" || (item.tags ?? []).includes("patchnotes"))
    .map((item) => toPatchNote(item, language));
}
