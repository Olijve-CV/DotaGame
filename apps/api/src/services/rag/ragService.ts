import type { Article, Language } from "@dotagame/contracts";
import { listKnowledgeDocuments, listPatchNotes } from "../contentService.js";
import { getEmbeddingProvider } from "./embeddingProvider.js";
import type { RagContext, RagPayload, VectorPoint } from "./types.js";
import { getVectorStore } from "./vectorStore.js";

const INDEX_TTL_MS = 10 * 60 * 1000;

interface IndexState {
  indexedAt: number;
  signature: string;
}

const indexStateByLanguage = new Map<Language, IndexState>();

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

function toPayload(document: Article): RagPayload {
  return {
    id: document.id,
    title: document.title,
    summary: document.summary,
    source: document.source,
    sourceUrl: document.sourceUrl,
    publishedAt: document.publishedAt,
    language: document.language,
    tags: document.tags,
    category: document.category
  };
}

function buildSignature(documents: Article[]): string {
  return documents.map((item) => `${item.id}:${item.publishedAt}`).join("|");
}

async function buildKnowledgeDocuments(language: Language): Promise<Article[]> {
  const [articles, patchNotes] = await Promise.all([
    listKnowledgeDocuments(language),
    listPatchNotes(language)
  ]);
  const patchAsArticles: Article[] = patchNotes.map((patch) => ({
    ...patch,
    category: "patch"
  }));
  return dedupeById([...articles, ...patchAsArticles]).slice(0, 140);
}

async function ensureIndexed(language: Language): Promise<void> {
  const documents = await buildKnowledgeDocuments(language);
  const signature = buildSignature(documents);
  const previous = indexStateByLanguage.get(language);
  const now = Date.now();
  if (previous && previous.signature === signature && now - previous.indexedAt < INDEX_TTL_MS) {
    return;
  }

  const embeddingProvider = getEmbeddingProvider();
  const vectorStore = getVectorStore();

  const points: VectorPoint[] = [];
  for (const document of documents) {
    const textForEmbedding = `${document.title}\n${document.summary}\n${document.tags.join(" ")}`;
    const vector = await embeddingProvider.embed(textForEmbedding);
    points.push({
      id: `${language}:${document.id}`,
      vector,
      payload: toPayload(document)
    });
  }

  await vectorStore.upsert(points);
  indexStateByLanguage.set(language, { indexedAt: now, signature });
}

export async function retrieveRagContext(input: {
  question: string;
  language: Language;
  limit?: number;
}): Promise<RagContext> {
  await ensureIndexed(input.language);

  const embeddingProvider = getEmbeddingProvider();
  const vectorStore = getVectorStore();
  const vector = await embeddingProvider.embed(input.question);
  const matches = await vectorStore.query({
    vector,
    language: input.language,
    limit: input.limit ?? 4
  });

  const filteredMatches = matches.filter((match) => match.score >= 0.08);
  return {
    matches: filteredMatches,
    citations: filteredMatches.map((match) => ({
      id: match.payload.id,
      title: match.payload.title,
      source: match.payload.source,
      sourceUrl: match.payload.sourceUrl,
      publishedAt: match.payload.publishedAt
    }))
  };
}
