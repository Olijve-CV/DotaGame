import type { Language } from "@dotagame/contracts";
import { getRagConfig } from "./config.js";
import type { VectorMatch, VectorPoint, VectorStore } from "./types.js";

interface QdrantPoint {
  id: string;
  score: number;
  payload: VectorPoint["payload"];
}

export class QdrantVectorStore implements VectorStore {
  private collectionReady = false;
  private readonly config = getRagConfig();

  async upsert(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }
    await this.ensureCollection(points[0].vector.length);

    const payload = {
      points: points.map((point) => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload
      }))
    };

    await this.request(`/collections/${this.config.qdrantCollection}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async query(input: { vector: number[]; language: Language; limit: number }): Promise<VectorMatch[]> {
    await this.ensureCollection(input.vector.length);

    const body = {
      vector: input.vector,
      limit: input.limit,
      with_payload: true,
      filter: {
        must: [
          {
            key: "language",
            match: { value: input.language }
          }
        ]
      }
    };

    const response = await this.request<{ result?: QdrantPoint[] }>(
      `/collections/${this.config.qdrantCollection}/points/search`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );

    return (response.result ?? []).map((point) => ({
      id: String(point.id),
      score: point.score,
      payload: point.payload
    }));
  }

  private async ensureCollection(dimension: number): Promise<void> {
    if (this.collectionReady) {
      return;
    }
    await this.request(`/collections/${this.config.qdrantCollection}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: dimension,
          distance: "Cosine"
        }
      })
    });
    this.collectionReady = true;
  }

  private async request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.config.qdrantApiKey) {
      headers["api-key"] = this.config.qdrantApiKey;
    }

    const response = await fetch(`${this.config.qdrantUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`QDRANT_REQUEST_FAILED:${response.status}`);
    }

    return (await response.json()) as T;
  }
}
