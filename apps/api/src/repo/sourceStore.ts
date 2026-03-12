import type {
  Article,
  HeroDetail,
  HeroAvatarOption,
  Language,
  PatchNote,
  Tournament
} from "@dotagame/contracts";
import { getDatabaseClient } from "../lib/database.js";

type ContentKind = "article" | "patch_note" | "tournament";

interface ContentItemRow {
  id: string;
  kind: ContentKind;
  category: Article["category"] | null;
  language: Article["language"];
  source: string;
  source_url: string;
  title: string;
  summary: string;
  tags_json: string;
  published_at: string;
  version: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  tournament_status: Tournament["status"] | null;
  payload_json: string;
  updated_at: string;
}

interface HeroAvatarRow {
  hero_id: number;
  language: Article["language"];
  name: string;
  localized_name: string | null;
  display_name: string;
  image: string;
  primary_attr: HeroAvatarOption["primaryAttr"] | null;
  attack_type: HeroAvatarOption["attackType"] | null;
  roles_json: string;
  complexity: number | null;
  payload_json: string;
  updated_at: string;
}

interface HeroDetailRow {
  hero_id: number;
  language: Article["language"];
  name: string;
  localized_name: string | null;
  display_name: string;
  short_description: string;
  overview: string;
  biography: string;
  primary_attr: HeroDetail["primaryAttr"] | null;
  attack_type: HeroDetail["attackType"] | null;
  complexity: number;
  roles_json: string;
  role_levels_json: string;
  attributes_json: string;
  abilities_json: string;
  facets_json: string;
  payload_json: string;
  updated_at: string;
}

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toArticle(row: ContentItemRow): Article {
  return {
    id: row.id,
    category: row.category ?? "news",
    language: row.language,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    tags: parseJsonArray<string>(row.tags_json, []),
    publishedAt: row.published_at
  };
}

function toPatchNote(row: ContentItemRow): PatchNote {
  return {
    id: row.id,
    version: row.version ?? "unknown",
    language: row.language,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    tags: parseJsonArray<string>(row.tags_json, []),
    publishedAt: row.published_at
  };
}

function toTournament(row: ContentItemRow): Tournament {
  return {
    id: row.id,
    language: row.language,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    tags: parseJsonArray<string>(row.tags_json, []),
    publishedAt: row.published_at,
    region: row.region ?? "Global",
    startDate: row.start_date ?? row.published_at.slice(0, 10),
    endDate: row.end_date ?? row.published_at.slice(0, 10),
    status: row.tournament_status ?? "completed"
  };
}

function toHeroAvatar(row: HeroAvatarRow): HeroAvatarOption {
  return {
    id: row.hero_id,
    name: row.name,
    localizedName: row.localized_name ?? undefined,
    displayName: row.display_name,
    image: row.image,
    primaryAttr: row.primary_attr ?? undefined,
    attackType: row.attack_type ?? undefined,
    roles: parseJsonArray<string>(row.roles_json, []),
    complexity: row.complexity ?? undefined
  };
}

function toHeroDetail(row: HeroDetailRow): HeroDetail {
  return {
    id: row.hero_id,
    name: row.name,
    localizedName: row.localized_name ?? undefined,
    displayName: row.display_name,
    shortDescription: row.short_description,
    overview: row.overview,
    biography: row.biography,
    primaryAttr: row.primary_attr ?? undefined,
    attackType: row.attack_type ?? undefined,
    complexity: row.complexity,
    roles: parseJsonArray<string>(row.roles_json, []),
    roleLevels: parseJsonArray<number>(row.role_levels_json, []),
    attributes: parseJsonObject<HeroDetail["attributes"]>(row.attributes_json, null),
    abilities: parseJsonArray<HeroDetail["abilities"][number]>(row.abilities_json, []),
    facets: parseJsonArray<HeroDetail["facets"][number]>(row.facets_json, [])
  };
}

export async function getSourceSyncTime(datasetKey: string): Promise<string | null> {
  const db = await getDatabaseClient();
  const row = await db.get<{ synced_at: string }>(
    `
      SELECT synced_at
      FROM source_sync_state
      WHERE dataset_key = :datasetKey
    `,
    { datasetKey }
  );

  return row?.synced_at ?? null;
}

export async function setSourceSyncTime(datasetKey: string, syncedAt: string): Promise<void> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      INSERT INTO source_sync_state (dataset_key, synced_at)
      VALUES (:datasetKey, :syncedAt)
      ON CONFLICT (dataset_key) DO UPDATE SET synced_at = excluded.synced_at
    `,
    {
      datasetKey,
      syncedAt
    }
  );
}

export async function upsertArticles(items: Article[]): Promise<void> {
  const db = await getDatabaseClient();
  const updatedAt = new Date().toISOString();
  for (const item of items) {
    await db.execute(
      `
        INSERT INTO content_items (
          id, kind, category, language, source, source_url, title, summary, tags_json,
          published_at, version, region, start_date, end_date, tournament_status, payload_json, updated_at
        )
        VALUES (
          :id, 'article', :category, :language, :source, :sourceUrl, :title, :summary, :tagsJson,
          :publishedAt, NULL, NULL, NULL, NULL, NULL, :payloadJson, :updatedAt
        )
        ON CONFLICT (id) DO UPDATE SET
          category = excluded.category,
          language = excluded.language,
          source = excluded.source,
          source_url = excluded.source_url,
          title = excluded.title,
          summary = excluded.summary,
          tags_json = excluded.tags_json,
          published_at = excluded.published_at,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `,
      {
        id: item.id,
        category: item.category,
        language: item.language,
        source: item.source,
        sourceUrl: item.sourceUrl,
        title: item.title,
        summary: item.summary,
        tagsJson: toJson(item.tags),
        publishedAt: item.publishedAt,
        payloadJson: toJson(item),
        updatedAt
      }
    );
  }
}

export async function upsertPatchNotes(items: PatchNote[]): Promise<void> {
  const db = await getDatabaseClient();
  const updatedAt = new Date().toISOString();
  for (const item of items) {
    await db.execute(
      `
        INSERT INTO content_items (
          id, kind, category, language, source, source_url, title, summary, tags_json,
          published_at, version, region, start_date, end_date, tournament_status, payload_json, updated_at
        )
        VALUES (
          :id, 'patch_note', NULL, :language, :source, :sourceUrl, :title, :summary, :tagsJson,
          :publishedAt, :version, NULL, NULL, NULL, NULL, :payloadJson, :updatedAt
        )
        ON CONFLICT (id) DO UPDATE SET
          language = excluded.language,
          source = excluded.source,
          source_url = excluded.source_url,
          title = excluded.title,
          summary = excluded.summary,
          tags_json = excluded.tags_json,
          published_at = excluded.published_at,
          version = excluded.version,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `,
      {
        id: item.id,
        language: item.language,
        source: item.source,
        sourceUrl: item.sourceUrl,
        title: item.title,
        summary: item.summary,
        tagsJson: toJson(item.tags),
        publishedAt: item.publishedAt,
        version: item.version,
        payloadJson: toJson(item),
        updatedAt
      }
    );
  }
}

export async function upsertTournaments(items: Tournament[]): Promise<void> {
  const db = await getDatabaseClient();
  const updatedAt = new Date().toISOString();
  for (const item of items) {
    await db.execute(
      `
        INSERT INTO content_items (
          id, kind, category, language, source, source_url, title, summary, tags_json,
          published_at, version, region, start_date, end_date, tournament_status, payload_json, updated_at
        )
        VALUES (
          :id, 'tournament', NULL, :language, :source, :sourceUrl, :title, :summary, :tagsJson,
          :publishedAt, NULL, :region, :startDate, :endDate, :status, :payloadJson, :updatedAt
        )
        ON CONFLICT (id) DO UPDATE SET
          language = excluded.language,
          source = excluded.source,
          source_url = excluded.source_url,
          title = excluded.title,
          summary = excluded.summary,
          tags_json = excluded.tags_json,
          published_at = excluded.published_at,
          region = excluded.region,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          tournament_status = excluded.tournament_status,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `,
      {
        id: item.id,
        language: item.language,
        source: item.source,
        sourceUrl: item.sourceUrl,
        title: item.title,
        summary: item.summary,
        tagsJson: toJson(item.tags),
        publishedAt: item.publishedAt,
        region: item.region,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        payloadJson: toJson(item),
        updatedAt
      }
    );
  }
}

export async function listStoredArticles(language?: Article["language"]): Promise<Article[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<ContentItemRow>(
    `
      SELECT *
      FROM content_items
      WHERE kind = 'article' ${language ? "AND language = :language" : ""}
      ORDER BY published_at DESC, id ASC
    `,
    language ? { language } : undefined
  );
  return rows.map(toArticle);
}

export async function listStoredPatchNotes(language?: PatchNote["language"]): Promise<PatchNote[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<ContentItemRow>(
    `
      SELECT *
      FROM content_items
      WHERE kind = 'patch_note' ${language ? "AND language = :language" : ""}
      ORDER BY published_at DESC, id ASC
    `,
    language ? { language } : undefined
  );
  return rows.map(toPatchNote);
}

export async function listStoredTournaments(language?: Tournament["language"]): Promise<Tournament[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<ContentItemRow>(
    `
      SELECT *
      FROM content_items
      WHERE kind = 'tournament' ${language ? "AND language = :language" : ""}
      ORDER BY published_at DESC, id ASC
    `,
    language ? { language } : undefined
  );
  return rows.map(toTournament);
}

export async function upsertHeroAvatars(
  language: Language,
  items: HeroAvatarOption[]
): Promise<void> {
  const db = await getDatabaseClient();
  const updatedAt = new Date().toISOString();
  for (const item of items) {
    await db.execute(
      `
        INSERT INTO hero_avatars (
          hero_id, language, name, localized_name, display_name, image, primary_attr, attack_type,
          roles_json, complexity, payload_json, updated_at
        )
        VALUES (
          :heroId, :language, :name, :localizedName, :displayName, :image, :primaryAttr, :attackType,
          :rolesJson, :complexity, :payloadJson, :updatedAt
        )
        ON CONFLICT (hero_id, language) DO UPDATE SET
          name = excluded.name,
          localized_name = excluded.localized_name,
          display_name = excluded.display_name,
          image = excluded.image,
          primary_attr = excluded.primary_attr,
          attack_type = excluded.attack_type,
          roles_json = excluded.roles_json,
          complexity = excluded.complexity,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `,
      {
        heroId: item.id,
        language,
        name: item.name,
        localizedName: item.localizedName ?? null,
        displayName: item.displayName ?? item.name,
        image: item.image,
        primaryAttr: item.primaryAttr ?? null,
        attackType: item.attackType ?? null,
        rolesJson: toJson(item.roles ?? []),
        complexity: item.complexity ?? null,
        payloadJson: toJson(item),
        updatedAt
      }
    );
  }
}

export async function listStoredHeroAvatars(
  language: Language
): Promise<HeroAvatarOption[]> {
  const db = await getDatabaseClient();
  const rows = await db.all<HeroAvatarRow>(
    `
      SELECT *
      FROM hero_avatars
      WHERE language = :language
      ORDER BY display_name ASC, hero_id ASC
    `,
    { language }
  );

  return rows.map(toHeroAvatar);
}

export async function getStoredHeroAvatar(
  heroId: number,
  language: Language
): Promise<HeroAvatarOption | null> {
  const db = await getDatabaseClient();
  const row = await db.get<HeroAvatarRow>(
    `
      SELECT *
      FROM hero_avatars
      WHERE hero_id = :heroId AND language = :language
    `,
    {
      heroId,
      language
    }
  );

  return row ? toHeroAvatar(row) : null;
}

export async function upsertHeroDetail(language: Language, hero: HeroDetail): Promise<void> {
  const db = await getDatabaseClient();
  await db.execute(
    `
      INSERT INTO hero_details (
        hero_id, language, name, localized_name, display_name, short_description, overview, biography,
        primary_attr, attack_type, complexity, roles_json, role_levels_json, attributes_json,
        abilities_json, facets_json, payload_json, updated_at
      )
      VALUES (
        :heroId, :language, :name, :localizedName, :displayName, :shortDescription, :overview, :biography,
        :primaryAttr, :attackType, :complexity, :rolesJson, :roleLevelsJson, :attributesJson,
        :abilitiesJson, :facetsJson, :payloadJson, :updatedAt
      )
      ON CONFLICT (hero_id, language) DO UPDATE SET
        name = excluded.name,
        localized_name = excluded.localized_name,
        display_name = excluded.display_name,
        short_description = excluded.short_description,
        overview = excluded.overview,
        biography = excluded.biography,
        primary_attr = excluded.primary_attr,
        attack_type = excluded.attack_type,
        complexity = excluded.complexity,
        roles_json = excluded.roles_json,
        role_levels_json = excluded.role_levels_json,
        attributes_json = excluded.attributes_json,
        abilities_json = excluded.abilities_json,
        facets_json = excluded.facets_json,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    {
      heroId: hero.id,
      language,
      name: hero.name,
      localizedName: hero.localizedName ?? null,
      displayName: hero.displayName,
      shortDescription: hero.shortDescription,
      overview: hero.overview,
      biography: hero.biography,
      primaryAttr: hero.primaryAttr ?? null,
      attackType: hero.attackType ?? null,
      complexity: hero.complexity,
      rolesJson: toJson(hero.roles),
      roleLevelsJson: toJson(hero.roleLevels),
      attributesJson: toJson(hero.attributes),
      abilitiesJson: toJson(hero.abilities),
      facetsJson: toJson(hero.facets),
      payloadJson: toJson(hero),
      updatedAt: new Date().toISOString()
    }
  );
}

export async function getStoredHeroDetail(
  heroId: number,
  language: Language
): Promise<HeroDetail | null> {
  const db = await getDatabaseClient();
  const row = await db.get<HeroDetailRow>(
    `
      SELECT *
      FROM hero_details
      WHERE hero_id = :heroId AND language = :language
    `,
    {
      heroId,
      language
    }
  );

  return row ? toHeroDetail(row) : null;
}
