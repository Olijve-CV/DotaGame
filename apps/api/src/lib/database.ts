import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Pool } from "pg";
import { logger } from "./logger.js";

export type DbProvider = "sqlite" | "pgsql";

type DbValue = string | number | null;
type DbParams = Record<string, DbValue>;

interface DatabaseClient {
  provider: DbProvider;
  execute(text: string, params?: DbParams): Promise<void>;
  get<T>(text: string, params?: DbParams): Promise<T | null>;
  all<T>(text: string, params?: DbParams): Promise<T[]>;
  close(): Promise<void>;
}

interface DatabaseConfig {
  provider: DbProvider;
  sqlitePath: string;
  databaseUrl: string | null;
}

const SQLITE_MEMORY_PATH = ":memory:";
const DEFAULT_SQLITE_DB_PATH = path.resolve(import.meta.dirname, "../../.data/dotagame.db");

let databaseClientPromise: Promise<DatabaseClient> | null = null;
let databaseInfoLogged = false;

function getDatabaseConfig(): DatabaseConfig {
  const provider = process.env.DB_PROVIDER === "pgsql" ? "pgsql" : "sqlite";
  const defaultSqlitePath = process.env.NODE_ENV === "test" ? SQLITE_MEMORY_PATH : DEFAULT_SQLITE_DB_PATH;

  return {
    provider,
    sqlitePath: process.env.SQLITE_DB_PATH?.trim() || defaultSqlitePath,
    databaseUrl: process.env.DATABASE_URL?.trim() || null
  };
}

function compileNamedQuery(
  text: string,
  params: DbParams | undefined,
  provider: DbProvider
): { text: string; values: DbValue[] } {
  const source = params ?? {};
  const values: DbValue[] = [];
  let position = 0;

  const compiled = text.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    if (!(key in source)) {
      throw new Error(`DB_PARAM_MISSING:${key}`);
    }

    values.push(source[key]);
    position += 1;
    return provider === "sqlite" ? "?" : `$${position}`;
  });

  return {
    text: compiled,
    values
  };
}

function ensureSqliteDirectory(sqlitePath: string): void {
  if (sqlitePath === SQLITE_MEMORY_PATH) {
    return;
  }

  mkdirSync(path.dirname(sqlitePath), { recursive: true });
}

async function createSqliteClient(sqlitePath: string): Promise<DatabaseClient> {
  ensureSqliteDirectory(sqlitePath);
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA foreign_keys = ON;");

  return {
    provider: "sqlite",
    async execute(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "sqlite");
      if (compiled.values.length === 0) {
        db.exec(compiled.text);
        return;
      }

      db.prepare(compiled.text).run(...compiled.values);
    },
    async get<T>(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "sqlite");
      const statement = db.prepare(compiled.text);
      const row =
        compiled.values.length > 0
          ? (statement.get(...compiled.values) as T | undefined)
          : (statement.get() as T | undefined);
      return row ?? null;
    },
    async all<T>(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "sqlite");
      const statement = db.prepare(compiled.text);
      const rows =
        compiled.values.length > 0
          ? (statement.all(...compiled.values) as T[])
          : (statement.all() as T[]);
      return rows;
    },
    async close() {
      db.close();
    }
  };
}

async function createPgsqlClient(databaseUrl: string): Promise<DatabaseClient> {
  const { Pool: PgPool } = await import("pg");
  const pool: Pool = new PgPool({
    connectionString: databaseUrl
  });

  return {
    provider: "pgsql",
    async execute(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "pgsql");
      await pool.query(compiled.text, compiled.values);
    },
    async get<T>(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "pgsql");
      const result = await pool.query(compiled.text, compiled.values);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async all<T>(text: string, params?: DbParams) {
      const compiled = compileNamedQuery(text, params, "pgsql");
      const result = await pool.query(compiled.text, compiled.values);
      return result.rows as T[];
    },
    async close() {
      await pool.end();
    }
  };
}

async function initializeSchema(client: DatabaseClient): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_hero_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, content_type, content_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      mode TEXT NOT NULL,
      language TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NULL,
      parent_session_id TEXT NULL,
      root_session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      language TEXT NOT NULL,
      agent TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      agent TEXT NULL,
      content TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id
    ON auth_tokens(user_id);
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created_at
    ON chat_sessions(user_id, created_at DESC);
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_updated_at
    ON agent_sessions(user_id, updated_at DESC);
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_parent_created_at
    ON agent_sessions(parent_session_id, created_at ASC);
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created_at
    ON agent_messages(session_id, created_at ASC);
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS source_sync_state (
      dataset_key TEXT PRIMARY KEY,
      synced_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      category TEXT NULL,
      language TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      published_at TEXT NOT NULL,
      version TEXT NULL,
      region TEXT NULL,
      start_date TEXT NULL,
      end_date TEXT NULL,
      tournament_status TEXT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS hero_avatars (
      hero_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      name TEXT NOT NULL,
      localized_name TEXT NULL,
      display_name TEXT NOT NULL,
      image TEXT NOT NULL,
      primary_attr TEXT NULL,
      attack_type TEXT NULL,
      roles_json TEXT NOT NULL,
      complexity INTEGER NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (hero_id, language)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS hero_details (
      hero_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      name TEXT NOT NULL,
      localized_name TEXT NULL,
      display_name TEXT NOT NULL,
      short_description TEXT NOT NULL,
      overview TEXT NOT NULL,
      biography TEXT NOT NULL,
      primary_attr TEXT NULL,
      attack_type TEXT NULL,
      complexity INTEGER NOT NULL,
      roles_json TEXT NOT NULL,
      role_levels_json TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      abilities_json TEXT NOT NULL,
      facets_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (hero_id, language)
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_content_items_kind_language_published_at
    ON content_items(kind, language, published_at DESC);
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_hero_avatars_language_display_name
    ON hero_avatars(language, display_name ASC);
  `);
}

async function createDatabaseClient(): Promise<DatabaseClient> {
  const config = getDatabaseConfig();
  const client =
    config.provider === "pgsql"
      ? await createPgsqlClient(
          config.databaseUrl ?? (() => {
            throw new Error("DATABASE_URL_REQUIRED");
          })()
        )
      : await createSqliteClient(config.sqlitePath);

  await initializeSchema(client);

  if (!databaseInfoLogged) {
    databaseInfoLogged = true;
    logger.info("database initialized", {
      event: "db.initialized",
      provider: config.provider,
      sqlitePath: config.provider === "sqlite" ? config.sqlitePath : undefined
    });
  }

  return client;
}

export async function getDatabaseClient(): Promise<DatabaseClient> {
  if (!databaseClientPromise) {
    databaseClientPromise = createDatabaseClient().catch((error) => {
      databaseClientPromise = null;
      throw error;
    });
  }

  return databaseClientPromise;
}

export function getDatabaseInfo(): {
  provider: DbProvider;
  sqlitePath: string | null;
  hasDatabaseUrl: boolean;
} {
  const config = getDatabaseConfig();
  return {
    provider: config.provider,
    sqlitePath: config.provider === "sqlite" ? config.sqlitePath : null,
    hasDatabaseUrl: Boolean(config.databaseUrl)
  };
}

export async function resetDatabaseClientForTests(): Promise<void> {
  if (!databaseClientPromise) {
    return;
  }

  const client = await databaseClientPromise;
  await client.close();
  databaseClientPromise = null;
  databaseInfoLogged = false;
}
