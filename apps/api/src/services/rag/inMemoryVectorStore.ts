import type { Language } from "@dotagame/contracts";
import type { VectorMatch, VectorPoint, VectorStore } from "./types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export class InMemoryVectorStore implements VectorStore {
  private points = new Map<string, VectorPoint>();

  async upsert(points: VectorPoint[]): Promise<void> {
    for (const point of points) {
      this.points.set(point.id, point);
    }
  }

  async query(input: { vector: number[]; language: Language; limit: number }): Promise<VectorMatch[]> {
    const scored: VectorMatch[] = [];
    for (const point of this.points.values()) {
      if (point.payload.language !== input.language) {
        continue;
      }
      scored.push({
        id: point.id,
        score: cosineSimilarity(input.vector, point.vector),
        payload: point.payload
      });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, input.limit);
  }
}
