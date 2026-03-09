import type { HeroAttackType, HeroAvatarOption, HeroPrimaryAttribute } from "@dotagame/contracts";
import { logger } from "../lib/logger.js";
import { withCache } from "./sources/cache.js";

const HERO_AVATAR_CACHE_KEY = "hero-avatar-options";
const HERO_AVATAR_TTL_MS = 12 * 60 * 60 * 1000;
const OPEN_DOTA_HEROES_URL = "https://api.opendota.com/api/constants/heroes";

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

export async function listHeroAvatars(): Promise<HeroAvatarOption[]> {
  try {
    return await withCache(HERO_AVATAR_CACHE_KEY, HERO_AVATAR_TTL_MS, fetchHeroAvatarsFromSource);
  } catch (error) {
    logger.warn("failed to load hero avatars from OpenDota, using fallback avatars", {
      event: "content.hero_avatars.live_source_failed",
      error
    });
    return FALLBACK_HERO_AVATARS;
  }
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
