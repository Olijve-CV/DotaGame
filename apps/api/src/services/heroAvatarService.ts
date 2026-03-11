import type {
  HeroAttackType,
  HeroAvatarOption,
  HeroDetail,
  HeroFacetDetail,
  HeroPrimaryAttribute,
  Language
} from "@dotagame/contracts";
import { logger } from "../lib/logger.js";
import { withCache } from "./sources/cache.js";

const HERO_AVATAR_CACHE_KEY = "hero-avatar-options";
const HERO_AVATAR_TTL_MS = 12 * 60 * 60 * 1000;
const OPEN_DOTA_HEROES_URL = "https://api.opendota.com/api/constants/heroes";
const DOTA_HERO_LIST_URL = "https://www.dota2.com/datafeed/herolist";
const DOTA_HERO_DATA_URL = "https://www.dota2.com/datafeed/herodata";

const FALLBACK_HERO_AVATARS: HeroAvatarOption[] = [
  {
    id: 1,
    name: "Anti-Mage",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
    primaryAttr: "agi",
    attackType: "Melee",
    roles: ["Carry", "Escape", "Nuker"]
  },
  {
    id: 2,
    name: "Axe",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png",
    primaryAttr: "str",
    attackType: "Melee",
    roles: ["Initiator", "Durable", "Disabler", "Carry"]
  },
  {
    id: 5,
    name: "Crystal Maiden",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/crystal_maiden.png",
    primaryAttr: "int",
    attackType: "Ranged",
    roles: ["Support", "Disabler", "Nuker", "Jungler"]
  },
  {
    id: 8,
    name: "Juggernaut",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/juggernaut.png",
    primaryAttr: "agi",
    attackType: "Melee",
    roles: ["Carry", "Pusher", "Escape"]
  },
  {
    id: 14,
    name: "Pudge",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/pudge.png",
    primaryAttr: "str",
    attackType: "Melee",
    roles: ["Disabler", "Initiator", "Durable", "Nuker"]
  },
  {
    id: 35,
    name: "Sniper",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/sniper.png",
    primaryAttr: "agi",
    attackType: "Ranged",
    roles: ["Carry", "Nuker"]
  },
  {
    id: 44,
    name: "Phantom Assassin",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/phantom_assassin.png",
    primaryAttr: "agi",
    attackType: "Melee",
    roles: ["Carry", "Escape"]
  },
  {
    id: 53,
    name: "Nature's Prophet",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/furion.png",
    primaryAttr: "int",
    attackType: "Ranged",
    roles: ["Carry", "Pusher", "Escape", "Nuker"]
  },
  {
    id: 74,
    name: "Invoker",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/invoker.png",
    primaryAttr: "all",
    attackType: "Ranged",
    roles: ["Carry", "Nuker", "Disabler", "Escape", "Pusher"]
  },
  {
    id: 86,
    name: "Rubick",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/rubick.png",
    primaryAttr: "int",
    attackType: "Ranged",
    roles: ["Support", "Disabler", "Nuker"]
  },
  {
    id: 114,
    name: "Monkey King",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/monkey_king.png",
    primaryAttr: "agi",
    attackType: "Melee",
    roles: ["Carry", "Escape", "Disabler", "Initiator"]
  },
  {
    id: 138,
    name: "Muerta",
    image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/muerta.png",
    primaryAttr: "int",
    attackType: "Ranged",
    roles: ["Carry", "Nuker", "Disabler"]
  }
];

interface OpenDotaHeroRecord {
  id?: number;
  localized_name?: string;
  img?: string;
  cm_enabled?: boolean;
  primary_attr?: HeroPrimaryAttribute;
  attack_type?: HeroAttackType;
  roles?: string[];
}

interface DotaOfficialHeroListEntry {
  id: number;
  name_loc?: string;
  name_english_loc?: string;
  complexity?: number;
}

interface DotaOfficialHeroListPayload {
  result?: {
    data?: {
      heroes?: DotaOfficialHeroListEntry[];
    };
  };
}

interface DotaOfficialFacetRecord {
  title_loc?: string;
  description_loc?: string;
  name?: string;
}

interface DotaOfficialAbilityRecord {
  id?: number;
  name?: string;
  name_loc?: string;
  desc_loc?: string;
  lore_loc?: string;
  notes_loc?: string[];
  ability_is_innate?: boolean;
  ability_is_granted_by_scepter?: boolean;
  ability_is_granted_by_shard?: boolean;
  type?: number;
}

interface DotaOfficialHeroRecord {
  id?: number;
  name?: string;
  name_loc?: string;
  npe_desc_loc?: string;
  hype_loc?: string;
  bio_loc?: string;
  complexity?: number;
  primary_attr?: number;
  attack_capability?: number;
  role_levels?: number[];
  abilities?: DotaOfficialAbilityRecord[];
  facets?: DotaOfficialFacetRecord[];
}

interface DotaOfficialHeroPayload {
  result?: {
    status?: number;
    data?: {
      heroes?: DotaOfficialHeroRecord[];
    };
  };
}

export async function listHeroAvatars(language: Language = "en-US"): Promise<HeroAvatarOption[]> {
  const officialIndex = await loadOfficialHeroList(language).catch((error) => {
    logger.warn("failed to load official hero list metadata", {
      event: "content.hero_avatars.official_list_failed",
      language,
      error
    });
    return new Map<number, DotaOfficialHeroListEntry>();
  });

  let baseOptions: HeroAvatarOption[];
  try {
    baseOptions = await withCache(HERO_AVATAR_CACHE_KEY, HERO_AVATAR_TTL_MS, fetchHeroAvatarsFromSource);
  } catch (error) {
    logger.warn("failed to load hero avatars from OpenDota, using fallback avatars", {
      event: "content.hero_avatars.live_source_failed",
      error
    });
    baseOptions = FALLBACK_HERO_AVATARS;
  }

  return baseOptions.map((item) => enrichAvatarWithOfficialData(item, officialIndex.get(item.id), language));
}

export async function getHeroDetail(heroId: number, language: Language): Promise<HeroDetail | null> {
  const [avatars, officialHero] = await Promise.all([
    listHeroAvatars(language),
    fetchOfficialHero(heroId, language)
  ]);

  if (!officialHero || typeof officialHero.id !== "number" || typeof officialHero.name !== "string") {
    return null;
  }

  const avatar = avatars.find((item) => item.id === heroId);
  const name = avatar?.name ?? normalizeHeroName(officialHero.name);
  const localizedName =
    typeof officialHero.name_loc === "string" && officialHero.name_loc.trim().length > 0
      ? officialHero.name_loc.trim()
      : avatar?.localizedName;
  const displayName = language === "zh-CN" ? localizedName ?? name : name;
  const shortDescription = sanitizeHtmlText(officialHero.npe_desc_loc);
  const overview = sanitizeHtmlText(officialHero.hype_loc);
  const biography = sanitizeHtmlText(officialHero.bio_loc);
  const abilities = (officialHero.abilities ?? [])
    .filter((ability) => typeof ability.id === "number" && typeof ability.name === "string")
    .filter((ability) => ability.type !== 2)
    .map((ability) => toHeroAbilityDetail(ability, language))
    .filter(Boolean) as HeroDetail["abilities"];
  const facets = (officialHero.facets ?? [])
    .map((facet) => toHeroFacetDetail(facet, language))
    .filter(Boolean) as HeroFacetDetail[];

  return {
    id: heroId,
    name,
    localizedName,
    displayName,
    shortDescription,
    overview,
    biography,
    primaryAttr: avatar?.primaryAttr ?? mapOfficialPrimaryAttr(officialHero.primary_attr),
    attackType: avatar?.attackType ?? mapOfficialAttackCapability(officialHero.attack_capability),
    complexity: clampComplexity(officialHero.complexity ?? avatar?.complexity),
    roles: avatar?.roles ?? [],
    roleLevels: Array.isArray(officialHero.role_levels) ? officialHero.role_levels : [],
    abilities,
    facets
  };
}

export async function resolveHeroAvatarById(
  avatarHeroId: number | null | undefined
): Promise<HeroAvatarOption | null> {
  if (avatarHeroId == null) {
    return pickRandomHeroAvatar();
  }

  const options = await listHeroAvatars();
  return options.find((item) => item.id === avatarHeroId) ?? null;
}

export async function pickRandomHeroAvatar(): Promise<HeroAvatarOption> {
  const options = await listHeroAvatars();
  return options[Math.floor(Math.random() * options.length)] ?? FALLBACK_HERO_AVATARS[0];
}

async function fetchHeroAvatarsFromSource(): Promise<HeroAvatarOption[]> {
  const response = await fetch(OPEN_DOTA_HEROES_URL);
  if (!response.ok) {
    throw new Error("HERO_SOURCE_ERROR");
  }

  const payload = (await response.json()) as Record<string, OpenDotaHeroRecord>;
  const items = Object.values(payload)
    .filter(isHeroAvatarRecord)
    .filter((item) => item.cm_enabled !== false)
    .map((item) => ({
      id: item.id,
      name: item.localized_name,
      image: `https://cdn.cloudflare.steamstatic.com${item.img.replace(/\?$/, "")}`,
      primaryAttr: item.primary_attr,
      attackType: item.attack_type,
      roles: item.roles
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (items.length === 0) {
    throw new Error("HERO_SOURCE_EMPTY");
  }

  return items;
}

function isHeroAvatarRecord(
  item: OpenDotaHeroRecord
): item is Required<Pick<OpenDotaHeroRecord, "id" | "localized_name" | "img">> &
  OpenDotaHeroRecord {
  return (
    typeof item.id === "number" &&
    typeof item.localized_name === "string" &&
    item.localized_name.length > 0 &&
    typeof item.img === "string" &&
    item.img.length > 0
  );
}

async function loadOfficialHeroList(
  language: Language
): Promise<Map<number, DotaOfficialHeroListEntry>> {
  const cacheKey = `hero-official-list:${language}`;
  return withCache(cacheKey, HERO_AVATAR_TTL_MS, async () => {
    const response = await fetch(`${DOTA_HERO_LIST_URL}?language=${toDotaLanguage(language)}`);
    if (!response.ok) {
      throw new Error("DOTA_HERO_LIST_ERROR");
    }

    const payload = (await response.json()) as DotaOfficialHeroListPayload;
    const items = payload.result?.data?.heroes ?? [];
    return new Map(items.filter((item) => typeof item.id === "number").map((item) => [item.id, item]));
  });
}

async function fetchOfficialHero(
  heroId: number,
  language: Language
): Promise<DotaOfficialHeroRecord | null> {
  const cacheKey = `hero-official-detail:${language}:${heroId}`;
  return withCache(cacheKey, HERO_AVATAR_TTL_MS, async () => {
    const response = await fetch(
      `${DOTA_HERO_DATA_URL}?language=${toDotaLanguage(language)}&hero_id=${heroId}`
    );
    if (!response.ok) {
      throw new Error("DOTA_HERO_DETAIL_ERROR");
    }

    const payload = (await response.json()) as DotaOfficialHeroPayload;
    return payload.result?.data?.heroes?.[0] ?? null;
  });
}

function enrichAvatarWithOfficialData(
  item: HeroAvatarOption,
  official: DotaOfficialHeroListEntry | undefined,
  language: Language
): HeroAvatarOption {
  const localizedName =
    typeof official?.name_loc === "string" && official.name_loc.trim().length > 0
      ? official.name_loc.trim()
      : undefined;
  const englishName =
    typeof official?.name_english_loc === "string" && official.name_english_loc.trim().length > 0
      ? official.name_english_loc.trim()
      : item.name;

  return {
    ...item,
    name: englishName,
    localizedName,
    displayName: language === "zh-CN" ? localizedName ?? englishName : englishName,
    complexity: clampComplexity(official?.complexity)
  };
}

function toHeroAbilityDetail(
  ability: DotaOfficialAbilityRecord,
  language: Language
): HeroDetail["abilities"][number] | null {
  if (typeof ability.id !== "number" || typeof ability.name !== "string") {
    return null;
  }

  const name = normalizeAbilityName(ability.name);
  const localizedName =
    typeof ability.name_loc === "string" && ability.name_loc.trim().length > 0
      ? ability.name_loc.trim()
      : undefined;

  return {
    id: ability.id,
    name,
    localizedName,
    displayName: language === "zh-CN" ? localizedName ?? name : name,
    description: sanitizeHtmlText(ability.desc_loc),
    lore: sanitizeHtmlText(ability.lore_loc),
    notes: Array.isArray(ability.notes_loc) ? ability.notes_loc.map(sanitizeHtmlText).filter(Boolean) : [],
    isInnate: ability.ability_is_innate === true,
    isGrantedByScepter: ability.ability_is_granted_by_scepter === true,
    isGrantedByShard: ability.ability_is_granted_by_shard === true
  };
}

function toHeroFacetDetail(
  facet: DotaOfficialFacetRecord,
  language: Language
): HeroFacetDetail | null {
  const localizedName =
    typeof facet.title_loc === "string" && facet.title_loc.trim().length > 0
      ? facet.title_loc.trim()
      : undefined;
  const name =
    typeof facet.name === "string" && facet.name.trim().length > 0 ? normalizeAbilityName(facet.name) : null;
  const displayName = language === "zh-CN" ? localizedName ?? name : name ?? localizedName;

  if (!displayName) {
    return null;
  }

  return {
    name: name ?? displayName,
    localizedName,
    displayName,
    description: sanitizeHtmlText(facet.description_loc)
  };
}

function toDotaLanguage(language: Language): string {
  return language === "zh-CN" ? "schinese" : "english";
}

function sanitizeHtmlText(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?b>/gi, "")
    .replace(/%%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeroName(value: string): string {
  return value
    .replace(/^npc_dota_hero_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeAbilityName(value: string): string {
  return value
    .replace(/^[a-z0-9]+_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function mapOfficialPrimaryAttr(value: number | undefined): HeroPrimaryAttribute | undefined {
  switch (value) {
    case 0:
      return "str";
    case 1:
      return "agi";
    case 2:
      return "int";
    case 3:
      return "all";
    default:
      return undefined;
  }
}

function mapOfficialAttackCapability(value: number | undefined): HeroAttackType | undefined {
  switch (value) {
    case 1:
      return "Melee";
    case 2:
      return "Ranged";
    default:
      return undefined;
  }
}

function clampComplexity(value: number | undefined): number {
  if (value === 2 || value === 3) {
    return value;
  }

  return 1;
}
