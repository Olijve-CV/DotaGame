import type { ChatMode, Language } from "@dotagame/contracts";

export interface RagPayload {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  language: Language;
  tags: string[];
  category: string;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: RagPayload;
}

export interface VectorMatch {
  id: string;
  score: number;
  payload: RagPayload;
}

export interface VectorStore {
  upsert(points: VectorPoint[]): Promise<void>;
  query(input: { vector: number[]; language: Language; limit: number }): Promise<VectorMatch[]>;
}

export interface EmbeddingProvider {
  embed(input: string): Promise<number[]>;
  dimensions(): number;
}

export interface RagContext {
  matches: VectorMatch[];
  citations: Array<{
    id: string;
    title: string;
    source: string;
    sourceUrl: string;
    publishedAt: string;
  }>;
}

export interface LlmAnswerInput {
  question: string;
  mode: ChatMode;
  language: Language;
  context?: {
    hero?: string;
    rank?: string;
    lane?: string;
  };
  matches: VectorMatch[];
}

export interface LlmAnswerOutput {
  answer: string;
  confidence: number;
  followUps: string[];
}
