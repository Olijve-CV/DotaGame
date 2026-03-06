import type { Article, Language, PatchNote, Tournament } from "@dotagame/contracts";
import { articles, patchNotes, tournaments } from "../data/content.js";
import { heroGuides } from "../data/guides.js";

function sortByPublishedAtDesc<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function listArticles(params: {
  language?: Language;
  category?: Article["category"];
  query?: string;
}): Article[] {
  const query = params.query?.trim().toLowerCase();
  const merged = [...articles, ...heroGuides];

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

export function listPatchNotes(language?: Language): PatchNote[] {
  return sortByPublishedAtDesc(
    patchNotes.filter((item) => !language || item.language === language)
  );
}

export function listTournaments(language?: Language): Tournament[] {
  return sortByPublishedAtDesc(
    tournaments.filter((item) => !language || item.language === language)
  );
}

export function listKnowledgeDocuments(language?: Language): Article[] {
  return listArticles({ language });
}
