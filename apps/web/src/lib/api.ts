import type {
  AgentSession,
  AgentSessionDetail,
  AgentSessionSummary,
  Article,
  ChatRequest,
  ChatResponse,
  CreateAgentSessionRequest,
  FavoriteRecord,
  HeroAvatarOption,
  HeroDetail,
  Language,
  PatchNote,
  SendAgentMessageRequest,
  Tournament,
  UserProfile
} from "@dotagame/contracts";

const API_BASE = "/api/v1";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? "REQUEST_FAILED");
  }

  return (await response.json()) as T;
}

export async function fetchArticles(params: {
  language: Language;
  category?: "news" | "tournament" | "patch" | "guide";
  query?: string;
}): Promise<Article[]> {
  const query = new URLSearchParams();
  query.set("language", params.language);
  if (params.category) {
    query.set("category", params.category);
  }
  if (params.query) {
    query.set("query", params.query);
  }
  const data = await http<{ items: Article[] }>(`/articles?${query.toString()}`);
  return data.items;
}

export async function fetchPatchNotes(language: Language): Promise<PatchNote[]> {
  const data = await http<{ items: PatchNote[] }>(`/patch-notes?language=${language}`);
  return data.items;
}

export async function fetchTournaments(language: Language): Promise<Tournament[]> {
  const data = await http<{ items: Tournament[] }>(`/tournaments?language=${language}`);
  return data.items;
}

export async function fetchHeroAvatars(language: Language): Promise<HeroAvatarOption[]> {
  const data = await http<{ items: HeroAvatarOption[] }>(`/hero-avatars?language=${language}`);
  return data.items;
}

export async function fetchHeroDetail(heroId: number, language: Language): Promise<HeroDetail> {
  const data = await http<{ hero: HeroDetail }>(`/heroes/${heroId}?language=${language}`);
  return data.hero;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  avatarHeroId?: number;
}): Promise<{ token: string; user: UserProfile }> {
  return http("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: UserProfile }> {
  return http("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchMe(token: string): Promise<UserProfile> {
  const result = await http<{ user: UserProfile }>("/users/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.user;
}

export async function updateMyAvatar(
  token: string,
  avatarHeroId: number | null
): Promise<UserProfile> {
  const result = await http<{ user: UserProfile }>("/users/me/avatar", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ avatarHeroId })
  });
  return result.user;
}

export async function fetchFavorites(token: string): Promise<FavoriteRecord[]> {
  const result = await http<{ items: FavoriteRecord[] }>("/users/me/favorites", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.items;
}

export async function addFavorite(
  token: string,
  input: { contentType: "article" | "patch" | "tournament"; contentId: string }
): Promise<FavoriteRecord[]> {
  const result = await http<{ items: FavoriteRecord[] }>("/users/me/favorites", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
  return result.items;
}

export async function removeFavorite(
  token: string,
  input: { contentType: "article" | "patch" | "tournament"; contentId: string }
): Promise<FavoriteRecord[]> {
  const result = await http<{ items: FavoriteRecord[] }>(
    `/users/me/favorites/${input.contentType}/${encodeURIComponent(input.contentId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return result.items;
}

export async function fetchChatSessions(token: string) {
  const result = await http<{
    items: Array<{ id: string; question: string; answer: string; createdAt: string }>;
  }>("/users/me/chat-sessions", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.items;
}

export async function askChat(
  request: ChatRequest,
  token?: string | null
): Promise<ChatResponse> {
  return http<ChatResponse>("/chat", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(request)
  });
}

export async function fetchAgentSessions(token?: string | null): Promise<AgentSessionSummary[]> {
  const result = await http<{ items: AgentSessionSummary[] }>("/agent/sessions", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  return result.items;
}

export async function createAgentSession(
  input: CreateAgentSessionRequest,
  token?: string | null
): Promise<AgentSession> {
  const result = await http<{ session: AgentSession }>("/agent/sessions", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(input)
  });
  return result.session;
}

export async function fetchAgentSession(
  sessionId: string,
  token?: string | null
): Promise<AgentSessionDetail> {
  return http<AgentSessionDetail>(`/agent/sessions/${sessionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
}

export async function fetchAgentSessionChildren(
  sessionId: string,
  token?: string | null
): Promise<AgentSessionSummary[]> {
  const result = await http<{ items: AgentSessionSummary[] }>(`/agent/sessions/${sessionId}/children`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  return result.items;
}

export async function sendAgentMessage(
  sessionId: string,
  input: SendAgentMessageRequest,
  token?: string | null
): Promise<AgentSessionDetail> {
  return http<AgentSessionDetail>(`/agent/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(input)
  });
}

export function getAgentSessionEventsUrl(sessionId: string, token?: string | null): string {
  const query = new URLSearchParams();
  if (token) {
    query.set("token", token);
  }
  const suffix = query.toString();
  return `${API_BASE}/agent/sessions/${sessionId}/events${suffix ? `?${suffix}` : ""}`;
}
