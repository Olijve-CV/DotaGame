import type { Article, Language, PatchNote, Tournament } from "@dotagame/contracts";
import { articles, patchNotes, tournaments } from "../data/content.js";
import { heroGuides } from "../data/guides.js";
import { fetchOpenDotaTournaments } from "./sources/openDotaSource.js";
import { fetchSteamArticles, fetchSteamPatchNotes } from "./sources/steamSource.js";

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

export async function listArticles(params: {
  language?: Language;
  category?: Article["category"];
  query?: string;
}): Promise<Article[]> {
  const query = params.query?.trim().toLowerCase();
  const language = params.language ?? "en-US";
  const liveItems = await fetchSteamArticles(language).catch(() => []);
  const merged = dedupeById([...liveItems, ...articles, ...heroGuides]);

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
  const currentLanguage = language ?? "en-US";
  const liveItems = await fetchSteamPatchNotes(currentLanguage).catch(() => []);
  const merged = dedupeById([...liveItems, ...patchNotes]);
  return sortByPublishedAtDesc(merged.filter((item) => !language || item.language === language));
}

export async function listTournaments(language?: Language): Promise<Tournament[]> {
  const currentLanguage = language ?? "en-US";
  const liveItems = await fetchOpenDotaTournaments(currentLanguage).catch(() => []);
  const merged = dedupeById([...liveItems, ...tournaments]);
  return sortByPublishedAtDesc(merged.filter((item) => !language || item.language === language));
}

export async function listKnowledgeDocuments(language?: Language): Promise<Article[]> {
  return listArticles({ language });
}
