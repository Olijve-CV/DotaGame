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

export type AgentToolName = "knowledge_search" | "web_search" | "dota_live_search";

export type AgentSessionStatus = "idle" | "running" | "completed" | "failed";

export type AgentExecutionStatus = "running" | "completed" | "failed";

export interface AgentSession {
  id: string;
  userId: string | null;
  parentSessionId: string | null;
  rootSessionId: string;
  title: string;
  language: Language;
  agent: AgentKind;
  kind: "primary" | "subagent";
  status: AgentSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  language: Language;
  agent: AgentKind;
  kind: "primary" | "subagent";
  parentSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  status: AgentSessionStatus;
  lastMessage: string;
  childCount: number;
}

export interface AgentTextPart {
  type: "text";
  text: string;
}

export interface AgentToolCallPart {
  type: "tool_call";
  tool: AgentToolName;
  status: AgentExecutionStatus;
  inputSummary: string;
  outputSummary: string;
  citations: ChatCitation[];
}

export interface AgentTaskCallPart {
  type: "task_call";
  taskId: string;
  subagent: AgentKind;
  status: AgentExecutionStatus;
  childSessionId: string;
  instruction: string;
  summary: string;
}

export type AgentMessagePart = AgentTextPart | AgentToolCallPart | AgentTaskCallPart;

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  agent: AgentKind | null;
  content: string;
  parts: AgentMessagePart[];
  createdAt: string;
}

export interface AgentSessionDetail {
  session: AgentSession;
  messages: AgentMessage[];
  children: AgentSessionSummary[];
}

export type AgentSessionEventType =
  | "session.detail"
  | "session.completed"
  | "session.failed"
  | "keepalive";

export interface AgentSessionEvent {
  type: AgentSessionEventType;
  sessionId: string;
  rootSessionId: string;
  detail?: AgentSessionDetail;
  error?: string;
  timestamp: string;
}

export interface CreateAgentSessionRequest {
  language: Language;
  title?: string;
}

export interface SendAgentMessageRequest {
  message: string;
  language: Language;
}
