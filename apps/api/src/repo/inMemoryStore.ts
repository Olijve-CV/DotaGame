import type {
  ChatSessionRecord,
  FavoriteRecord,
  HeroAvatarOption,
  Language,
  UserProfile
} from "@dotagame/contracts";
import { randomUUID, createHash } from "node:crypto";
import { getDatabaseClient } from "../lib/database.js";
import { pickRandomHeroAvatar, resolveHeroAvatarById } from "../services/heroAvatarService.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_hero_id: number;
  created_at: string;
  password_hash: string;
}

interface FavoriteRow {
  user_id: string;
  content_type: FavoriteRecord["contentType"];
  content_id: string;
  created_at: string;
}

interface ChatSessionRow {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  mode: "quick" | "coach";
  language: Language;
  created_at: string;
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function getUserRowByEmail(email: string): Promise<UserRow | null> {
  const db = await getDatabaseClient();
  return db.get<UserRow>(
    `
      SELECT id, email, name, avatar_hero_id, created_at, password_hash
      FROM users
      WHERE email = :email
    `,
    { email }
  );
}

async function getUserRowById(userId: string): Promise<UserRow | null> {
  const db = await getDatabaseClient();
  return db.get<UserRow>(
    `
      SELECT id, email, name, avatar_hero_id, created_at, password_hash
      FROM users
      WHERE id = :userId
    `,
    { userId }
  );
}

async function resolvePersistedAvatar(avatarHeroId: number): Promise<HeroAvatarOption> {
  const avatar = await resolveHeroAvatarById(avatarHeroId);
  return avatar ?? (await pickRandomHeroAvatar());
}

async function toUserProfile(row: UserRow): Promise<UserProfile> {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: await resolvePersistedAvatar(row.avatar_hero_id),
    createdAt: row.created_at
  };
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  avatarHeroId?: number
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getUserRowByEmail(normalizedEmail);
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const avatar = await resolveHeroAvatarById(avatarHeroId ?? null);
  if (!avatar) {
    throw new Error("INVALID_AVATAR");
  }

  const userId = randomUUID();
  const createdAt = new Date().toISOString();
  const db = await getDatabaseClient();

  await db.execute(
    `
      INSERT INTO users (id, email, name, avatar_hero_id, created_at, password_hash)
      VALUES (:id, :email, :name, :avatarHeroId, :createdAt, :passwordHash)
    `,
    {
      id: userId,
      email: normalizedEmail,
      name,
      avatarHeroId: avatar.id,
      createdAt,
      passwordHash: hashPassword(password)
    }
  );

  return {
    id: userId,
    email: normalizedEmail,
    name,
    avatar,
    createdAt
  };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: UserProfile }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getUserRowByEmail(normalizedEmail);
  if (!existing || existing.password_hash !== hashPassword(password)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = randomUUID();
  const db = await getDatabaseClient();
  await db.execute(
    `
      INSERT INTO auth_tokens (token, user_id, created_at)
      VALUES (:token, :userId, :createdAt)
    `,
    {
      token,
      userId: existing.id,
      createdAt: new Date().toISOString()
    }
  );

  return {
    token,
    user: await toUserProfile(existing)
  };
}

export async function getUserByToken(token: string): Promise<UserProfile | null> {
  const db = await getDatabaseClient();
  const row = await db.get<UserRow>(
    `
      SELECT u.id, u.email, u.name, u.avatar_hero_id, u.created_at, u.password_hash
      FROM auth_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token = :token
    `,
    { token }
  );

  return row ? toUserProfile(row) : null;
}

export async function updateUserAvatar(
  userId: string,
  avatarHeroId: number | null
): Promise<UserProfile> {
  const entity = await getUserRowById(userId);
  if (!entity) {
    throw new Error("USER_NOT_FOUND");
  }

  const avatar = await resolveHeroAvatarById(avatarHeroId);
  if (!avatar) {
    throw new Error("INVALID_AVATAR");
  }

  const db = await getDatabaseClient();
  await db.execute(
    `
      UPDATE users
      SET avatar_hero_id = :avatarHeroId
      WHERE id = :userId
    `,
    {
      avatarHeroId: avatar.id,
      userId
    }
  );

  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    avatar,
    createdAt: entity.created_at
  };
}

export async function getFavorites(userId: string): Promise<FavoriteRecord[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<FavoriteRow>(
    `
      SELECT user_id, content_type, content_id, created_at
      FROM favorites
      WHERE user_id = :userId
      ORDER BY created_at DESC
    `,
    { userId }
  );

  return rows.map((row) => ({
    userId: row.user_id,
    contentType: row.content_type,
    contentId: row.content_id,
    createdAt: row.created_at
  }));
}

export async function addFavorite(
  userId: string,
  contentType: FavoriteRecord["contentType"],
  contentId: string
): Promise<FavoriteRecord[]> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      INSERT INTO favorites (user_id, content_type, content_id, created_at)
      VALUES (:userId, :contentType, :contentId, :createdAt)
      ON CONFLICT (user_id, content_type, content_id) DO NOTHING
    `,
    {
      userId,
      contentType,
      contentId,
      createdAt: new Date().toISOString()
    }
  );

  return getFavorites(userId);
}

export async function removeFavorite(
  userId: string,
  contentType: FavoriteRecord["contentType"],
  contentId: string
): Promise<FavoriteRecord[]> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      DELETE FROM favorites
      WHERE user_id = :userId AND content_type = :contentType AND content_id = :contentId
    `,
    {
      userId,
      contentType,
      contentId
    }
  );

  return getFavorites(userId);
}

export async function getChatSessions(userId: string): Promise<ChatSessionRecord[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<ChatSessionRow>(
    `
      SELECT id, user_id, question, answer, mode, language, created_at
      FROM chat_sessions
      WHERE user_id = :userId
      ORDER BY created_at DESC
      LIMIT 50
    `,
    { userId }
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    question: row.question,
    answer: row.answer,
    mode: row.mode,
    language: row.language,
    createdAt: row.created_at
  }));
}

export async function addChatSession(input: {
  userId: string;
  question: string;
  answer: string;
  mode: "quick" | "coach";
  language: Language;
}): Promise<ChatSessionRecord> {
  const session: ChatSessionRecord = {
    id: randomUUID(),
    userId: input.userId,
    question: input.question,
    answer: input.answer,
    mode: input.mode,
    language: input.language,
    createdAt: new Date().toISOString()
  };
  const db = await getDatabaseClient();

  await db.execute(
    `
      INSERT INTO chat_sessions (id, user_id, question, answer, mode, language, created_at)
      VALUES (:id, :userId, :question, :answer, :mode, :language, :createdAt)
    `,
    {
      id: session.id,
      userId: session.userId,
      question: session.question,
      answer: session.answer,
      mode: session.mode,
      language: session.language,
      createdAt: session.createdAt
    }
  );

  const staleRows = await db.all<{ id: string }>(
    `
      SELECT id
      FROM chat_sessions
      WHERE user_id = :userId
      ORDER BY created_at DESC
      LIMIT 1000
    `,
    { userId: input.userId }
  );

  for (const staleRow of staleRows.slice(50)) {
    await db.execute(
      `
        DELETE FROM chat_sessions
        WHERE id = :id
      `,
      { id: staleRow.id }
    );
  }

  return session;
}
