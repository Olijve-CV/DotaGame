import type {
  ChatSessionRecord,
  FavoriteRecord,
  Language,
  UserProfile
} from "@dotagame/contracts";
import { randomUUID, createHash } from "node:crypto";
import { resolveHeroAvatarById } from "../services/heroAvatarService.js";

interface UserEntity extends UserProfile {
  passwordHash: string;
}

const users = new Map<string, UserEntity>();
const tokens = new Map<string, string>();
const favorites = new Map<string, FavoriteRecord[]>();
const chatSessions = new Map<string, ChatSessionRecord[]>();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  avatarHeroId?: number
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = [...users.values()].find((user) => user.email === normalizedEmail);
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const avatar = await resolveHeroAvatarById(avatarHeroId ?? null);
  if (!avatar) {
    throw new Error("INVALID_AVATAR");
  }

  const id = randomUUID();
  const entity: UserEntity = {
    id,
    email: normalizedEmail,
    name,
    avatar,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password)
  };

  users.set(id, entity);
  favorites.set(id, []);
  chatSessions.set(id, []);
  return toUserProfile(entity);
}

export function loginUser(email: string, password: string): { token: string; user: UserProfile } {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = [...users.values()].find((user) => user.email === normalizedEmail);
  if (!existing || existing.passwordHash !== hashPassword(password)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = randomUUID();
  tokens.set(token, existing.id);
  return { token, user: toUserProfile(existing) };
}

export function getUserByToken(token: string): UserProfile | null {
  const userId = tokens.get(token);
  if (!userId) {
    return null;
  }
  const user = users.get(userId);
  return user ? toUserProfile(user) : null;
}

export async function updateUserAvatar(
  userId: string,
  avatarHeroId: number | null
): Promise<UserProfile> {
  const entity = users.get(userId);
  if (!entity) {
    throw new Error("USER_NOT_FOUND");
  }

  const avatar = await resolveHeroAvatarById(avatarHeroId);
  if (!avatar) {
    throw new Error("INVALID_AVATAR");
  }

  entity.avatar = avatar;
  users.set(userId, entity);
  return toUserProfile(entity);
}

export function getFavorites(userId: string): FavoriteRecord[] {
  return favorites.get(userId) ?? [];
}

export function addFavorite(
  userId: string,
  contentType: FavoriteRecord["contentType"],
  contentId: string
): FavoriteRecord[] {
  const list = favorites.get(userId) ?? [];
  const duplicate = list.some(
    (item) => item.contentType === contentType && item.contentId === contentId
  );
  if (!duplicate) {
    list.unshift({
      userId,
      contentType,
      contentId,
      createdAt: new Date().toISOString()
    });
  }
  favorites.set(userId, list);
  return list;
}

export function removeFavorite(
  userId: string,
  contentType: FavoriteRecord["contentType"],
  contentId: string
): FavoriteRecord[] {
  const list = favorites.get(userId) ?? [];
  const nextList = list.filter(
    (item) => !(item.contentType === contentType && item.contentId === contentId)
  );
  favorites.set(userId, nextList);
  return nextList;
}

export function getChatSessions(userId: string): ChatSessionRecord[] {
  return chatSessions.get(userId) ?? [];
}

export function addChatSession(input: {
  userId: string;
  question: string;
  answer: string;
  mode: "quick" | "coach";
  language: Language;
}): ChatSessionRecord {
  const session: ChatSessionRecord = {
    id: randomUUID(),
    userId: input.userId,
    question: input.question,
    answer: input.answer,
    mode: input.mode,
    language: input.language,
    createdAt: new Date().toISOString()
  };

  const list = chatSessions.get(input.userId) ?? [];
  list.unshift(session);
  chatSessions.set(input.userId, list.slice(0, 50));
  return session;
}

function toUserProfile(entity: UserEntity): UserProfile {
  const { passwordHash: _, ...profile } = entity;
  return profile;
}
