import { getRagConfig } from "./config.js";
import { logger } from "../../lib/logger.js";
import { buildApiUrl } from "./http.js";
import type { EmbeddingProvider } from "./types.js";

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

class DeterministicEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimension: number) {}

  async embed(input: string): Promise<number[]> {
    const tokens = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    const vector = new Array<number>(this.dimension).fill(0);

    for (const token of tokens) {
      const hash = fnv1a32(token);
      const index = hash % this.dimension;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[index] += sign;
    }

    return normalize(vector);
  }

  dimensions(): number {
    return this.dimension;
  }
}

class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly fallback = new DeterministicEmbeddingProvider(384);

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly dimension: number
  ) {}

  async embed(input: string): Promise<number[]> {
    try {
      const response = await fetch(buildApiUrl(this.baseUrl, "/embeddings"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input
        })
      });

      if (!response.ok) {
        throw new Error(`OPENAI_EMBEDDING_FAILED:${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };

      const vector = payload.data?.[0]?.embedding;
      if (!vector || vector.length === 0) {
        throw new Error("OPENAI_EMBEDDING_EMPTY");
      }
      return normalize(vector);
    } catch (error) {
      logger.warn("OpenAI embedding request failed, using deterministic embedding fallback", {
        event: "rag.embedding.fallback",
        model: this.model,
        error
      });
      return this.fallback.embed(input);
    }
  }

  dimensions(): number {
    return this.dimension;
  }
}

let singleton: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (singleton) {
    return singleton;
  }

  const config = getRagConfig();
  if (config.openAiApiKey) {
    singleton = new OpenAiEmbeddingProvider(
      config.openAiApiKey,
      config.openAiBaseUrl,
      config.embeddingModel,
      1536
    );
    return singleton;
  }

  singleton = new DeterministicEmbeddingProvider(384);
  return singleton;
}
