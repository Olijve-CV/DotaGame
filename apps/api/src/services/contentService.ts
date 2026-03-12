import type { Article, Language, PatchNote, Tournament } from "@dotagame/contracts";
import { articles, patchNotes, tournaments } from "../data/content.js";
import { heroGuides } from "../data/guides.js";
import { logger } from "../lib/logger.js";
import {
  getSourceSyncTime,
  listStoredArticles,
  listStoredPatchNotes,
  listStoredTournaments,
  setSourceSyncTime,
  upsertArticles,
  upsertPatchNotes,
  upsertTournaments
} from "../repo/sourceStore.js";
import { fetchOpenDotaMetaArticles } from "./sources/openDotaMetaSource.js";
import { fetchOpenDotaTournaments } from "./sources/openDotaSource.js";
import { fetchSteamArticles, fetchSteamPatchNotes } from "./sources/steamSource.js";
import { fetchSteamPlayerActivityArticles } from "./sources/steamMetricsSource.js";

const CONTENT_SYNC_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_LANGUAGES: Language[] = ["zh-CN", "en-US"];

function sortByPublishedAtDesc<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function isSyncFresh(syncedAt: string | null, ttlMs: number): boolean {
  if (!syncedAt) {
    return false;
  }

  return Date.now() - new Date(syncedAt).getTime() < ttlMs;
}

function hasAllowedSourceUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    if (
      hostname === "example.com" ||
      hostname.endsWith(".example.com") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function filterValidSourceUrls<T extends { sourceUrl: string }>(items: T[]): T[] {
  return items.filter((item) => hasAllowedSourceUrl(item.sourceUrl));
}

async function loadArticleLiveSources(language: Language): Promise<Article[]> {
  const liveSources = await Promise.allSettled([
    fetchSteamArticles(language),
    fetchSteamPlayerActivityArticles(language),
    fetchOpenDotaMetaArticles(language)
  ]);

  return liveSources.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const sourceName =
      index === 0 ? "steam_news" : index === 1 ? "steam_player_activity" : "opendota_meta";
    logger.warn("failed to load article live source, continuing with remaining sources", {
      event: "content.articles.live_source_partial_failed",
      language,
      sourceName,
      error: result.reason
    });
    return [];
  });
}

async function ensureArticlesSynced(language: Language): Promise<void> {
  const datasetKey = `content:articles:${language}`;
  const existing = await listStoredArticles(language);
  const syncedAt = await getSourceSyncTime(datasetKey);
  if (existing.length > 0 && isSyncFresh(syncedAt, CONTENT_SYNC_TTL_MS)) {
    return;
  }

  try {
    const liveItems = await loadArticleLiveSources(language);

    await upsertArticles(dedupeById(filterValidSourceUrls([...liveItems, ...articles, ...heroGuides])));
    await setSourceSyncTime(datasetKey, new Date().toISOString());
  } catch (error) {
    if (existing.length > 0) {
      logger.warn("article sync failed, returning stored DB content", {
        event: "content.articles.sync_failed",
        language,
        error
      });
      return;
    }
    throw error;
  }
}

async function ensurePatchNotesSynced(language: Language): Promise<void> {
  const datasetKey = `content:patch_notes:${language}`;
  const existing = await listStoredPatchNotes(language);
  const syncedAt = await getSourceSyncTime(datasetKey);
  if (existing.length > 0 && isSyncFresh(syncedAt, CONTENT_SYNC_TTL_MS)) {
    return;
  }

  try {
    const liveItems = await fetchSteamPatchNotes(language).catch((error: unknown) => {
      logger.warn("failed to load live Steam patch notes, falling back to stored/static content", {
        event: "content.patch_notes.live_source_failed",
        language,
        error
      });
      return [];
    });

    await upsertPatchNotes(dedupeById(filterValidSourceUrls([...liveItems, ...patchNotes])));
    await setSourceSyncTime(datasetKey, new Date().toISOString());
  } catch (error) {
    if (existing.length > 0) {
      logger.warn("patch-note sync failed, returning stored DB content", {
        event: "content.patch_notes.sync_failed",
        language,
        error
      });
      return;
    }
    throw error;
  }
}

async function ensureTournamentsSynced(language: Language): Promise<void> {
  const datasetKey = `content:tournaments:${language}`;
  const existing = await listStoredTournaments(language);
  const syncedAt = await getSourceSyncTime(datasetKey);
  if (existing.length > 0 && isSyncFresh(syncedAt, CONTENT_SYNC_TTL_MS)) {
    return;
  }

  try {
    const liveItems = await fetchOpenDotaTournaments(language).catch((error: unknown) => {
      logger.warn("failed to load live OpenDota tournaments, falling back to stored/static content", {
        event: "content.tournaments.live_source_failed",
        language,
        error
      });
      return [];
    });

    await upsertTournaments(dedupeById(filterValidSourceUrls([...liveItems, ...tournaments])));
    await setSourceSyncTime(datasetKey, new Date().toISOString());
  } catch (error) {
    if (existing.length > 0) {
      logger.warn("tournament sync failed, returning stored DB content", {
        event: "content.tournaments.sync_failed",
        language,
        error
      });
      return;
    }
    throw error;
  }
}

export async function listArticles(params: {
  language?: Language;
  category?: Article["category"];
  query?: string;
}): Promise<Article[]> {
  const query = params.query?.trim().toLowerCase();
  const languages = params.language ? [params.language] : SUPPORTED_LANGUAGES;
  await Promise.all(languages.map((language) => ensureArticlesSynced(language)));
  const merged = filterValidSourceUrls(await listStoredArticles(params.language));

  const filtered = merged.filter((item) => {
    if (params.language && item.language !== params.language) {
      return false;
    }
    if (params.category && item.category !== params.category) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(query) ||
      item.summary.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return sortByPublishedAtDesc(filtered);
}

export async function listPatchNotes(language?: Language): Promise<PatchNote[]> {
  await Promise.all((language ? [language] : SUPPORTED_LANGUAGES).map(ensurePatchNotesSynced));
  return sortByPublishedAtDesc(filterValidSourceUrls(await listStoredPatchNotes(language)));
}

export async function listTournaments(language?: Language): Promise<Tournament[]> {
  await Promise.all((language ? [language] : SUPPORTED_LANGUAGES).map(ensureTournamentsSynced));
  return sortByPublishedAtDesc(filterValidSourceUrls(await listStoredTournaments(language)));
}

export async function listKnowledgeDocuments(language?: Language): Promise<Article[]> {
  return listArticles({ language });
}
