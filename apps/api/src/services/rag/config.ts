export interface RagRuntimeConfig {
  vectorStoreProvider: "memory" | "qdrant";
  qdrantUrl: string;
  qdrantApiKey: string | undefined;
  qdrantCollection: string;
  openAiApiKey: string | undefined;
  openAiBaseUrl: string;
  embeddingModel: string;
  chatModel: string;
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
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini"
  };
}
