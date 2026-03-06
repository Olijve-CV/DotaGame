import { getRagConfig } from "./config.js";
import { InMemoryVectorStore } from "./inMemoryVectorStore.js";
import { QdrantVectorStore } from "./qdrantVectorStore.js";
import type { VectorStore } from "./types.js";

let singleton: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (singleton) {
    return singleton;
  }

  const config = getRagConfig();
  if (config.vectorStoreProvider === "qdrant") {
    singleton = new QdrantVectorStore();
    return singleton;
  }

  singleton = new InMemoryVectorStore();
  return singleton;
}
