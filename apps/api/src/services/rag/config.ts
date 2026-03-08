export interface RagRuntimeConfig {
  vectorStoreProvider: "memory" | "qdrant";
  qdrantUrl: string;
  qdrantApiKey: string | undefined;
  qdrantCollection: string;
  openAiApiKey: string | undefined;
  openAiBaseUrl: string;
  embeddingModel: string;
  chatModel: string;
  webSearchModel: string;
  webSearchCountry: string | undefined;
  webSearchCity: string | undefined;
  webSearchRegion: string | undefined;
  webSearchTimezone: string | undefined;
}

export function getRagConfig(): RagRuntimeConfig {
  return {
    vectorStoreProvider: process.env.VECTOR_STORE_PROVIDER === "qdrant" ? "qdrant" : "memory",
    qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
    qdrantApiKey: process.env.QDRANT_API_KEY,
    qdrantCollection: process.env.QDRANT_COLLECTION ?? "dota_knowledge",
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
    webSearchModel: process.env.OPENAI_WEB_SEARCH_MODEL ?? "o4-mini",
    webSearchCountry: process.env.OPENAI_WEB_SEARCH_COUNTRY,
    webSearchCity: process.env.OPENAI_WEB_SEARCH_CITY,
    webSearchRegion: process.env.OPENAI_WEB_SEARCH_REGION,
    webSearchTimezone: process.env.OPENAI_WEB_SEARCH_TIMEZONE
  };
}
