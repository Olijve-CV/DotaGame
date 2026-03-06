export type Language = "zh-CN" | "en-US";

export type ContentCategory = "news" | "tournament" | "patch" | "guide";

export interface ContentBase {
  id: string;
  language: Language;
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string;
}

export interface Article extends ContentBase {
  category: ContentCategory;
}

export interface PatchNote extends ContentBase {
  version: string;
}

export interface Tournament extends ContentBase {
  region: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "ongoing" | "completed";
}

export type ChatMode = "quick" | "coach";

export interface ChatRequest {
  question: string;
  mode: ChatMode;
  language: Language;
  context?: {
    hero?: string;
    rank?: string;
    lane?: string;
  };
}

export interface ChatCitation {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  confidence: number;
  followUps: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface FavoriteRecord {
  userId: string;
  contentType: "article" | "patch" | "tournament";
  contentId: string;
  createdAt: string;
}

export interface ChatSessionRecord {
  id: string;
  userId: string;
  question: string;
  answer: string;
  mode: ChatMode;
  language: Language;
  createdAt: string;
}
