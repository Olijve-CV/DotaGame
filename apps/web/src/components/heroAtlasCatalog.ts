import type { HeroAttackType, HeroAvatarOption, HeroPrimaryAttribute, Language } from "@dotagame/contracts";
import type { IntroHero, RoleKey } from "./DotaIntroData";

type AtlasRole = Exclude<RoleKey, "all">;

export type AtlasHero = IntroHero & {
  id: number | null;
  image?: string;
  isCurated: boolean;
  localizedName?: string;
  displayName?: string;
  roles: string[];
  primaryAttr?: HeroPrimaryAttribute;
  attackType?: HeroAttackType;
  complexity?: number;
};

const ROLE_LABELS: Record<Language, Record<AtlasRole, string>> = {
  "zh-CN": {
    carry: "核心输出",
    mid: "中路节奏",
    offlane: "三号位前排",
    support: "辅助支撑"
  },
  "en-US": {
    carry: "Carry focus",
    mid: "Mid tempo",
    offlane: "Offlane pressure",
    support: "Support control"
  }
};

const LANE_LABELS: Record<Language, Record<AtlasRole, string>> = {
  "zh-CN": {
    carry: "通常在优势路承担 1 号位核心",
    mid: "通常在中路承担 2 号位节奏职责",
    offlane: "通常在劣势路承担 3 号位前排职责",
    support: "通常承担 4/5 号位辅助职责"
  },
  "en-US": {
    carry: "Usually played as a position 1 safe-lane core",
    mid: "Usually played as a position 2 mid tempo core",
    offlane: "Usually played as a position 3 offlane frontliner",
    support: "Usually played as a position 4 or 5 support"
  }
};

const TIMING_LABELS: Record<Language, Record<AtlasRole, string>> = {
  "zh-CN": {
    carry: "两件核心装后进入主要发力期",
    mid: "6 级和首个节奏装后开始带动地图",
    offlane: "先手装和团队装成型后压力明显",
    support: "对线期和中期小规模交战最有价值"
  },
  "en-US": {
    carry: "Main impact appears after the first two core items",
    mid: "Starts dictating tempo after level 6 and the first active item",
    offlane: "Pressure spikes once initiation or aura items come online",
    support: "Most valuable in lanes and mid-game skirmishes"
  }
};

const ACCENT_BY_ROLE: Record<AtlasRole, string> = {
  carry: "#9a6a12",
  mid: "#305e99",
  offlane: "#8c4630",
  support: "#1f7a73"
};

const PRIMARY_ATTR_LABELS: Record<Language, Record<HeroPrimaryAttribute, string>> = {
  "zh-CN": {
    str: "力量",
    agi: "敏捷",
    int: "智力",
    all: "全才"
  },
  "en-US": {
    str: "Strength",
    agi: "Agility",
    int: "Intelligence",
    all: "Universal"
  }
};

const ATTACK_TYPE_LABELS: Record<Language, Record<HeroAttackType, string>> = {
  "zh-CN": {
    Melee: "近战",
    Ranged: "远程"
  },
  "en-US": {
    Melee: "Melee",
    Ranged: "Ranged"
  }
};

export function buildHeroAtlas(
  locale: Language,
  avatars: HeroAvatarOption[],
  curatedHeroes: IntroHero[]
): AtlasHero[] {
  const curatedByName = new Map(curatedHeroes.map((hero) => [hero.name, hero]));
  const catalogHeroes = avatars.map((avatar) => {
    const curatedHero = curatedByName.get(avatar.name);
    if (curatedHero) {
      return {
        ...curatedHero,
        id: avatar.id,
        image: avatar.image,
        isCurated: true,
        localizedName: avatar.localizedName,
        displayName: avatar.displayName,
        roles: avatar.roles ?? [],
        primaryAttr: avatar.primaryAttr,
        attackType: avatar.attackType,
        complexity: avatar.complexity
      };
    }

    return createGeneratedHero(locale, avatar);
  });

  if (catalogHeroes.length === 0) {
    return curatedHeroes.map((hero) => ({
      ...hero,
      id: null,
      image: undefined,
      isCurated: true,
      localizedName: undefined,
      displayName: hero.name,
      roles: [],
      primaryAttr: undefined,
      attackType: undefined,
      complexity: undefined
    }));
  }

  for (const hero of curatedHeroes) {
    if (!catalogHeroes.some((item) => item.name === hero.name)) {
      catalogHeroes.push({
        ...hero,
        id: null,
        image: undefined,
        isCurated: true,
        localizedName: undefined,
        displayName: hero.name,
        roles: [],
        primaryAttr: undefined,
        attackType: undefined,
        complexity: undefined
      });
    }
  }

  return catalogHeroes;
}

function createGeneratedHero(locale: Language, hero: HeroAvatarOption): AtlasHero {
  const role = inferAtlasRole(hero);
  const roleLabel = ROLE_LABELS[locale][role];
  const primaryAttr = hero.primaryAttr;
  const attackType = hero.attackType;
  const roleTags = hero.roles?.length ? hero.roles : defaultRoleTags(locale, role);
  const overview = buildOverview(locale, hero.name, roleLabel, primaryAttr, attackType, roleTags);

  return {
    id: hero.id,
    name: hero.name,
    role,
    roleLabel,
    difficulty: estimateDifficulty(locale, roleTags.length),
    lane: LANE_LABELS[locale][role],
    specialty: buildSpecialty(locale, roleTags),
    timing: TIMING_LABELS[locale][role],
    overview,
    accent: ACCENT_BY_ROLE[role],
    skills: buildProfileCards(locale, roleLabel, primaryAttr, attackType, roleTags),
    image: hero.image,
    isCurated: false,
    localizedName: hero.localizedName,
    displayName: hero.displayName,
    roles: roleTags,
    primaryAttr,
    attackType,
    complexity: hero.complexity
  };
}

function inferAtlasRole(hero: HeroAvatarOption): AtlasRole {
  const roleSet = new Set(hero.roles ?? []);
  if (roleSet.has("Support")) {
    return "support";
  }

  if (roleSet.has("Carry")) {
    return "carry";
  }

  if (hero.attackType === "Melee" && (roleSet.has("Initiator") || roleSet.has("Durable"))) {
    return "offlane";
  }

  return "mid";
}

function estimateDifficulty(locale: Language, roleCount: number): string {
  if (locale === "zh-CN") {
    if (roleCount >= 4) {
      return "中高";
    }

    if (roleCount <= 2) {
      return "中等";
    }

    return "中高";
  }

  if (roleCount >= 4) {
    return "Medium-High";
  }

  if (roleCount <= 2) {
    return "Medium";
  }

  return "Medium-High";
}

function buildSpecialty(locale: Language, roleTags: string[]): string {
  if (locale === "zh-CN") {
    return `公开标签：${roleTags.join(" / ")}`;
  }

  return `OpenDota tags: ${roleTags.join(" / ")}`;
}

function buildOverview(
  locale: Language,
  heroName: string,
  roleLabel: string,
  primaryAttr: HeroPrimaryAttribute | undefined,
  attackType: HeroAttackType | undefined,
  roleTags: string[]
): string {
  const attrLabel = primaryAttr ? PRIMARY_ATTR_LABELS[locale][primaryAttr] : undefined;
  const attackLabel = attackType ? ATTACK_TYPE_LABELS[locale][attackType] : undefined;

  if (locale === "zh-CN") {
    const descriptors = [attrLabel, attackLabel].filter(Boolean).join(" / ");
    const descriptorText = descriptors ? `${descriptors}英雄` : "英雄";
    return `${heroName} 是一名${descriptorText}。当前图鉴先按“${roleLabel}”来理解他，公开职责标签包括 ${roleTags.join(" / ")}，适合先建立定位和节奏认知，再继续细看具体技能与对局细节。`;
  }

  const descriptors = [attrLabel, attackLabel].filter(Boolean).join(" ");
  const descriptorText = descriptors ? `${descriptors} hero` : "hero";
  return `${heroName} is a ${descriptorText}. The atlas reads this hero first through a ${roleLabel.toLowerCase()} lens, with public role tags including ${roleTags.join(", ")} so you can anchor lane job, pacing, and draft identity before digging deeper.`;
}

function buildProfileCards(
  locale: Language,
  roleLabel: string,
  primaryAttr: HeroPrimaryAttribute | undefined,
  attackType: HeroAttackType | undefined,
  roleTags: string[]
): Array<{ name: string; detail: string }> {
  const primaryLabel = primaryAttr
    ? PRIMARY_ATTR_LABELS[locale][primaryAttr]
    : locale === "zh-CN"
      ? "未提供"
      : "Unavailable";
  const attackLabel = attackType
    ? ATTACK_TYPE_LABELS[locale][attackType]
    : locale === "zh-CN"
      ? "未提供"
      : "Unavailable";

  if (locale === "zh-CN") {
    return [
      { name: "主属性", detail: primaryLabel },
      { name: "攻击方式", detail: attackLabel },
      { name: "图鉴视角", detail: roleLabel },
      { name: "公开标签", detail: roleTags.join(" / ") }
    ];
  }

  return [
    { name: "Primary Attribute", detail: primaryLabel },
    { name: "Attack Type", detail: attackLabel },
    { name: "Atlas Lens", detail: roleLabel },
    { name: "Public Tags", detail: roleTags.join(", ") }
  ];
}

function defaultRoleTags(locale: Language, role: AtlasRole): string[] {
  if (locale === "zh-CN") {
    const labels: Record<AtlasRole, string[]> = {
      carry: ["核心", "发育", "后期输出"],
      mid: ["中路", "节奏", "爆发"],
      offlane: ["前排", "先手", "团战"],
      support: ["辅助", "控制", "视野"]
    };
    return labels[role];
  }

  const labels: Record<AtlasRole, string[]> = {
    carry: ["Core", "Scaling", "Damage"],
    mid: ["Tempo", "Burst", "Rotation"],
    offlane: ["Frontline", "Initiation", "Teamfight"],
    support: ["Support", "Control", "Vision"]
  };
  return labels[role];
}
