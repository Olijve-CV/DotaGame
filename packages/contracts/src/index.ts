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

export interface HeroAvatarOption {
  id: number;
  name: string;
  image: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: HeroAvatarOption;
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

export type AgentKind = "orchestrator" | "researcher" | "coach";

export type AgentToolName = "knowledge_search" | "web_search";

export type AgentRunStatus = "running" | "completed" | "failed";

export type AgentStepStatus = "completed" | "waiting" | "failed";

export type AgentStepType = "plan" | "delegate" | "tool_call" | "final";

export interface AgentThread {
  id: string;
  userId: string | null;
  title: string;
  language: Language;
  createdAt: string;
  updatedAt: string;
}

export interface AgentThreadSummary {
  id: string;
  title: string;
  language: Language;
  updatedAt: string;
  lastMessage: string;
  status: AgentRunStatus | "idle";
}

export interface AgentMessage {
  id: string;
  threadId: string;
  runId: string | null;
  role: "user" | "assistant";
  agent: AgentKind | null;
  content: string;
  createdAt: string;
}

export interface AgentToolCall {
  id: string;
  tool: AgentToolName;
  status: "completed" | "waiting" | "failed";
  requiresApproval: boolean;
  inputSummary: string;
  outputSummary?: string;
  citations?: ChatCitation[];
}

export interface AgentRunStep {
  id: string;
  runId: string;
  type: AgentStepType;
  status: AgentStepStatus;
  agent: AgentKind;
  title: string;
  detail: string;
  createdAt: string;
  toolCall?: AgentToolCall;
}

export interface AgentRun {
  id: string;
  threadId: string;
  mode: ChatMode;
  language: Language;
  status: AgentRunStatus;
  summary: string;
  finalAnswer?: string;
  createdAt: string;
  updatedAt: string;
  steps: AgentRunStep[];
  citations: ChatCitation[];
}

export interface AgentThreadDetail {
  thread: AgentThread;
  messages: AgentMessage[];
  runs: AgentRun[];
}

export interface AgentRunRequest {
  message: string;
  mode: ChatMode;
  language: Language;
}

export interface CreateAgentThreadRequest {
  language: Language;
  title?: string;
}
