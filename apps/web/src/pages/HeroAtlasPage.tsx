import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { HeroAbilityDetail, HeroAvatarOption, HeroDetail, HeroPrimaryAttribute, Language } from "@dotagame/contracts";
import { copyMap as introCopyMap, HERO_IMAGE_FALLBACKS } from "../components/DotaIntroData";
import { buildHeroAtlas } from "../components/heroAtlasCatalog";
import { fetchHeroAvatars, fetchHeroDetail } from "../lib/api";

type AttributeFilterKey = "allHeroes" | HeroPrimaryAttribute | "unknown";

const FILTER_ORDER: AttributeFilterKey[] = ["allHeroes", "str", "agi", "int", "all"];

const attributeLabels: Record<Language, Record<HeroPrimaryAttribute, string>> = {
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

const attackLabels = {
  "zh-CN": {
    Melee: "近战",
    Ranged: "远程"
  },
  "en-US": {
    Melee: "Melee",
    Ranged: "Ranged"
  }
} as const;

const attributeSearchAliases: Record<HeroPrimaryAttribute, string[]> = {
  str: ["str", "strength", "tank", "frontline", "力量"],
  agi: ["agi", "agility", "carry", "damage", "敏捷"],
  int: ["int", "intelligence", "caster", "support", "智力"],
  all: ["all", "universal", "hybrid", "全才", "全属性"]
};

function SkillIcon(props: {
  iconUrl: string | null;
  glyph: string;
  className: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [props.iconUrl]);

  if (!props.iconUrl || hasError) {
    return <span className={props.className}>{props.glyph}</span>;
  }

  return (
    <span className={props.className}>
      <img
        alt=""
        aria-hidden="true"
        onError={() => setHasError(true)}
        src={props.iconUrl}
      />
    </span>
  );
}

const pageCopy = {
  "zh-CN": {
    kicker: "Hero Atlas",
    title: "像官方英雄页一样浏览整套英雄池",
    summary:
      "把英雄页改成单独的沉浸式浏览器。先在上方聚焦当前英雄，再用属性筛选和海报墙快速切换目标，比原先按段落翻找更接近 Dota 2 官方英雄页的阅读方式。",
    search: "搜索英雄名称或属性",
    loading: "正在载入英雄图谱...",
    empty: "当前筛选下没有匹配的英雄。",
    allHeroes: "全部英雄",
    countLabel: "英雄总数",
    visibleLabel: "当前结果",
    attrLabel: "主属性",
    attackLabel: "攻击方式",
    roleLabel: "定位视角",
    tagsLabel: "公开标签",
    rosterTitle: "英雄矩阵",
    rosterHint: "点击下方英雄卡切换聚焦内容。",
    rolesTitle: "英雄身份",
    skillsTitle: "核心技能",
    overviewTitle: "英雄概览",
    subtitleLabel: "战斗档案",
    skillCountLabel: "核心技能",
    tagCountLabel: "公开标签",
    combatLabel: "战斗类型",
    backIntro: "返回新手指南",
    openChat: "打开智能问答",
    filters: {
      allHeroes: {
        label: "全部",
        hint: "浏览完整英雄池。"
      },
      str: {
        label: "力量",
        hint: "更偏前排、承伤、开团与强行接战。"
      },
      agi: {
        label: "敏捷",
        hint: "更偏持续输出、机动与成长型核心。"
      },
      int: {
        label: "智力",
        hint: "更偏技能驱动、控制、爆发和节奏。"
      },
      all: {
        label: "全才",
        hint: "属性成长更灵活，打法经常跨定位。"
      },
      unknown: {
        label: "未标注",
        hint: "接口暂未返回主属性的英雄。"
      }
    }
  },
  "en-US": {
    kicker: "Hero Atlas",
    title: "Browse the roster like the official heroes page",
    summary:
      "The page now works like a dedicated hero browser. Keep one hero in the spotlight, then switch quickly with attribute tabs and a dense hero wall instead of paging through separate grouped sections.",
    search: "Search hero names or attributes",
    loading: "Loading hero atlas...",
    empty: "No heroes matched this filter.",
    allHeroes: "All Heroes",
    countLabel: "Total Heroes",
    visibleLabel: "Visible Now",
    attrLabel: "Primary Attribute",
    attackLabel: "Attack Type",
    roleLabel: "Atlas Lens",
    tagsLabel: "Public Tags",
    rosterTitle: "Hero Roster",
    rosterHint: "Use the cards below to swap the spotlight hero instantly.",
    rolesTitle: "Hero Identity",
    skillsTitle: "Core Skills",
    overviewTitle: "Overview",
    subtitleLabel: "Combat Profile",
    skillCountLabel: "Core Skills",
    tagCountLabel: "Public Tags",
    combatLabel: "Combat Type",
    backIntro: "Back to Starter Guide",
    openChat: "Open Agent Chat",
    filters: {
      allHeroes: {
        label: "All",
        hint: "Browse the full hero pool."
      },
      str: {
        label: "Strength",
        hint: "Frontline pressure, initiation, and durability."
      },
      agi: {
        label: "Agility",
        hint: "Scaling damage, mobility, and farming cores."
      },
      int: {
        label: "Intelligence",
        hint: "Spell-heavy control, burst, and tempo."
      },
      all: {
        label: "Universal",
        hint: "Flexible stat lines that bend across jobs."
      },
      unknown: {
        label: "Unclassified",
        hint: "Heroes without a returned primary attribute."
      }
    }
  }
} satisfies Record<
  Language,
  {
    kicker: string;
    title: string;
    summary: string;
    search: string;
    loading: string;
    empty: string;
    allHeroes: string;
    countLabel: string;
    visibleLabel: string;
    attrLabel: string;
    attackLabel: string;
    roleLabel: string;
    tagsLabel: string;
    rosterTitle: string;
    rosterHint: string;
    rolesTitle: string;
    skillsTitle: string;
    overviewTitle: string;
    subtitleLabel: string;
    skillCountLabel: string;
    tagCountLabel: string;
    combatLabel: string;
    backIntro: string;
    openChat: string;
    filters: Record<AttributeFilterKey, { label: string; hint: string }>;
  }
>;

export function HeroAtlasPage(props: { locale: Language }) {
  const pageText = pageCopy[props.locale];
  const introText = introCopyMap[props.locale];
  const [avatars, setAvatars] = useState<HeroAvatarOption[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<AttributeFilterKey>("allHeroes");
  const [selectedHeroName, setSelectedHeroName] = useState("");
  const [hoveredHeroName, setHoveredHeroName] = useState("");
  const [selectedHeroDetail, setSelectedHeroDetail] = useState<HeroDetail | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;
    setIsLoadingAvatars(true);
    fetchHeroAvatars(props.locale)
      .then((items) => {
        if (active) {
          setAvatars(items);
        }
      })
      .catch(() => {
        if (active) {
          setAvatars([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAvatars(false);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale]);

  const heroAtlas = useMemo(
    () => buildHeroAtlas(props.locale, avatars, introText.heroSpotlights),
    [avatars, introText.heroSpotlights, props.locale]
  );

  const heroCounts = useMemo(() => {
    const counts = {
      allHeroes: heroAtlas.length,
      str: 0,
      agi: 0,
      int: 0,
      all: 0,
      unknown: 0
    } satisfies Record<AttributeFilterKey, number>;

    for (const hero of heroAtlas) {
      const key = hero.primaryAttr ?? "unknown";
      counts[key] += 1;
    }

    return counts;
  }, [heroAtlas]);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const visibleHeroes = useMemo(() => {
    return heroAtlas.filter((hero) => {
      const matchesFilter =
        activeFilter === "allHeroes"
          ? true
          : activeFilter === "unknown"
            ? !hero.primaryAttr
            : hero.primaryAttr === activeFilter;

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const attrAliases = hero.primaryAttr ? attributeSearchAliases[hero.primaryAttr] : ["unknown", "unclassified", "未标注"];
      const localizedAttrLabel = hero.primaryAttr ? attributeLabels[props.locale][hero.primaryAttr] : pageText.filters.unknown.label;
      const attackLabel = hero.attackType ? attackLabels[props.locale][hero.attackType] : "";
      const searchableText = [
        hero.name,
        hero.localizedName,
        hero.displayName,
        hero.roleLabel,
        localizedAttrLabel,
        ...attrAliases,
        attackLabel,
        ...(hero.roles ?? [])
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [activeFilter, heroAtlas, normalizedQuery, pageText.filters.unknown.label, props.locale]);

  useEffect(() => {
    if (visibleHeroes.some((hero) => hero.name === selectedHeroName)) {
      return;
    }

    setSelectedHeroName(visibleHeroes[0]?.name ?? heroAtlas[0]?.name ?? "");
  }, [heroAtlas, selectedHeroName, visibleHeroes]);

  const selectedHero =
    visibleHeroes.find((hero) => hero.name === selectedHeroName) ??
    visibleHeroes[0] ??
    heroAtlas[0];

  useEffect(() => {
    if (!selectedHero?.id) {
      setSelectedHeroDetail(null);
      return;
    }

    let active = true;
    fetchHeroDetail(selectedHero.id, props.locale)
      .then((detail) => {
        if (active) {
          setSelectedHeroDetail(detail);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedHeroDetail(null);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale, selectedHero?.id]);

  const selectedHeroImage = selectedHero
    ? selectedHero.image ?? HERO_IMAGE_FALLBACKS[selectedHero.name]
    : undefined;

  const selectedFilter = pageText.filters[activeFilter];
  const selectedHeroStyle = {
    "--hero-accent": selectedHero?.accent ?? "#c1462f"
  } as CSSProperties;

  const resolvedSkills = useMemo(
    () =>
      selectedHeroDetail?.abilities?.length
        ? selectedHeroDetail.abilities.map((ability) => ({
            key: ability.name,
            name: ability.displayName,
            detail: formatAbilityDetail(ability),
            notes: ability.notes,
            isInnate: ability.isInnate,
            isGrantedByScepter: ability.isGrantedByScepter,
            isGrantedByShard: ability.isGrantedByShard
          }))
        : (selectedHero?.skills ?? []).map((skill) => ({
            key: skill.name,
            name: skill.name,
            detail: skill.detail,
            notes: [],
            isInnate: false,
            isGrantedByScepter: false,
            isGrantedByShard: false
          })),
    [selectedHero?.skills, selectedHeroDetail?.abilities]
  );

  useEffect(() => {
    if (resolvedSkills.length === 0) {
      setSelectedSkillKey("");
      return;
    }

    if (resolvedSkills.some((skill) => skill.key === selectedSkillKey)) {
      return;
    }

    setSelectedSkillKey(resolvedSkills[0]?.key ?? "");
  }, [resolvedSkills, selectedSkillKey]);

  function getFilterTone(filterKey: AttributeFilterKey) {
    return filterKey === "allHeroes" ? "pool" : filterKey;
  }

  function getHeroAssetSlug(imageUrl: string | undefined) {
    if (!imageUrl) {
      return null;
    }

    const normalizedUrl = imageUrl.split("?")[0];
    const segments = normalizedUrl.split("/");
    const fileName = segments[segments.length - 1];
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  }

  function getHeroRenderVideoUrl(imageUrl: string | undefined) {
    const slug = getHeroAssetSlug(imageUrl);
    if (!slug) {
      return null;
    }

    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${slug}.webm`;
  }

  function getAbilitySlug(skillName: string) {
    return skillName
      .toLowerCase()
      .replace(/['.]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getSkillIconUrl(imageUrl: string | undefined, skillName: string) {
    const heroSlug = getHeroAssetSlug(imageUrl);
    const abilitySlug = getAbilitySlug(skillName);
    if (!heroSlug || !abilitySlug) {
      return null;
    }

    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${heroSlug}_${abilitySlug}.png`;
  }

  function getSkillGlyph(skillName: string) {
    const normalized = skillName
      .replace(/[^A-Za-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (normalized.length === 0) {
      return "SK";
    }

    if (normalized.length === 1) {
      return normalized[0].slice(0, 2).toUpperCase();
    }

    return normalized
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  const selectedHeroVideo = getHeroRenderVideoUrl(selectedHeroImage);
  const selectedSkill =
    resolvedSkills.find((skill) => skill.key === selectedSkillKey) ??
    resolvedSkills[0] ??
    null;
  const selectedHeroDisplayName =
    selectedHeroDetail?.displayName ?? selectedHero?.displayName ?? selectedHero?.localizedName ?? selectedHero?.name ?? "";
  const detailCopy =
    props.locale === "zh-CN"
      ? {
          biographyTitle: "英雄背景",
          profileTitle: "官方档案",
          attributesTitle: "属性成长",
          facetsTitle: "命石",
          facetsEmpty: "该英雄当前没有额外命石说明。",
          complexityLabel: "复杂度",
          innateLabel: "先天技能",
          scepterLabel: "神杖",
          shardLabel: "魔晶"
        }
      : {
          biographyTitle: "Biography",
          profileTitle: "Official Profile",
          attributesTitle: "Attributes",
          facetsTitle: "Facets",
          facetsEmpty: "No facet details are available for this hero right now.",
          complexityLabel: "Complexity",
          innateLabel: "Innate",
          scepterLabel: "Scepter",
          shardLabel: "Shard"
        };
  const selectedHeroLead = selectedHeroDetail?.shortDescription || selectedHero?.overview || "";
  const selectedHeroOverview = selectedHeroDetail?.overview || selectedHero?.overview || "";
  const selectedHeroBiography = selectedHeroDetail?.biography || selectedHero?.overview || "";
  const selectedHeroRoles = selectedHeroDetail?.roles.length ? selectedHeroDetail.roles : selectedHero?.roles ?? [];
  const selectedHeroComplexity = selectedHeroDetail?.complexity ?? selectedHero?.complexity ?? 1;
  const selectedHeroAttributes = selectedHeroDetail?.attributes ?? null;
  const selectedHeroSubtitle = selectedHero
    ? [
        selectedHero.primaryAttr ? attributeLabels[props.locale][selectedHero.primaryAttr] : pageText.filters.unknown.label,
        selectedHero.attackType ? attackLabels[props.locale][selectedHero.attackType] : null,
        selectedHero.roleLabel
      ]
        .filter(Boolean)
        .join(" / ")
    : "";

  return (
    <section className="stack hero-atlas-page official-hero-browser">
      <section className="panel hero-browser-hero">
        <div className="hero-browser-hero-copy">
          <p className="section-kicker">{pageText.kicker}</p>
          <h2>{pageText.title}</h2>
          <p className="hero-browser-summary">{pageText.summary}</p>

          <div className="hero-browser-actions">
            <Link className="ghost-btn" to="/intro">
              {pageText.backIntro}
            </Link>
            <Link className="primary-btn" to="/chat">
              {pageText.openChat}
            </Link>
          </div>
        </div>

        <div className="hero-browser-topline">
          <article className="hero-browser-metric">
            <span>{pageText.countLabel}</span>
            <strong>{heroCounts.allHeroes}</strong>
          </article>
          <article className="hero-browser-metric">
            <span>{pageText.visibleLabel}</span>
            <strong>{visibleHeroes.length}</strong>
          </article>
          <article className="hero-browser-metric hero-browser-metric-wide">
            <span>{selectedFilter.label}</span>
            <strong>{selectedFilter.hint}</strong>
          </article>
        </div>
      </section>

      {isLoadingAvatars && <p className="muted">{pageText.loading}</p>}

      {selectedHero ? (
        <section className="hero-browser-stage" style={selectedHeroStyle}>
          <article className="hero-browser-stage-main panel">
            <div className="hero-browser-stage-backdrop">
              {selectedHeroImage ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="hero-browser-stage-bg"
                  src={selectedHeroImage}
                />
              ) : null}
              <div aria-hidden="true" className="hero-browser-stage-figure">
                {selectedHeroVideo ? (
                  <video
                    autoPlay
                    className="hero-browser-stage-video"
                    key={selectedHeroVideo}
                    loop
                    muted
                    playsInline
                    poster={selectedHeroImage}
                    preload="auto"
                  >
                    <source src={selectedHeroVideo} type="video/webm" />
                  </video>
                ) : (
                  <div className="hero-browser-stage-placeholder">{selectedHero.name.slice(0, 2)}</div>
                )}
              </div>
            </div>

            <div className="hero-browser-stage-overlay" />

            <div className="hero-browser-stage-copy">
              <p className="hero-browser-stage-kicker">{selectedHero.roleLabel}</p>
              <h3>{selectedHeroDisplayName}</h3>
              <p className="hero-browser-stage-subtitle">
                {pageText.subtitleLabel}: {selectedHeroSubtitle}
              </p>

              <div className="hero-browser-stage-badges">
                {selectedHeroRoles.map((role) => (
                  <span className="hero-browser-badge" key={`${selectedHero.name}-${role}`}>
                    {role}
                  </span>
                ))}
              </div>

              <p className="hero-browser-stage-summary">{selectedHeroLead}</p>

              <div className="hero-browser-official-metrics">
                <article className="hero-browser-data-pill">
                  <span>{pageText.attrLabel}</span>
                  <strong>
                    {selectedHero.primaryAttr
                      ? attributeLabels[props.locale][selectedHero.primaryAttr]
                      : pageText.filters.unknown.label}
                  </strong>
                </article>
                <article className="hero-browser-data-pill">
                  <span>{pageText.attackLabel}</span>
                  <strong>
                    {selectedHero.attackType
                      ? attackLabels[props.locale][selectedHero.attackType]
                      : pageText.filters.unknown.label}
                  </strong>
                </article>
                <article className="hero-browser-data-pill hero-browser-data-pill-pips">
                  <span>{detailCopy.complexityLabel}</span>
                  <div
                    aria-label={`${detailCopy.complexityLabel}: ${selectedHeroComplexity}`}
                    className="hero-browser-complexity"
                  >
                    {[1, 2, 3].map((level) => (
                      <span
                        aria-hidden="true"
                        className={`hero-browser-complexity-dot${level <= selectedHeroComplexity ? " active" : ""}`}
                        key={level}
                      />
                    ))}
                  </div>
                </article>
                <article className="hero-browser-data-pill">
                  <span>{pageText.skillCountLabel}</span>
                  <strong>{resolvedSkills.length}</strong>
                </article>
              </div>

              <div className="hero-browser-story-grid">
                <article className="hero-browser-story-card">
                  <span>{pageText.overviewTitle}</span>
                  <p>{selectedHeroOverview}</p>
                </article>
                <article className="hero-browser-story-card">
                  <span>{detailCopy.biographyTitle}</span>
                  <p>{selectedHeroBiography}</p>
                </article>
              </div>

              {selectedHeroAttributes ? (
                <div className="hero-browser-attribute-grid">
                  <article className="hero-browser-identity-card">
                    <span>{attributeLabels[props.locale].str}</span>
                    <strong>{selectedHeroAttributes.str.base} + {selectedHeroAttributes.str.gain}</strong>
                  </article>
                  <article className="hero-browser-identity-card">
                    <span>{attributeLabels[props.locale].agi}</span>
                    <strong>{selectedHeroAttributes.agi.base} + {selectedHeroAttributes.agi.gain}</strong>
                  </article>
                  <article className="hero-browser-identity-card">
                    <span>{attributeLabels[props.locale].int}</span>
                    <strong>{selectedHeroAttributes.int.base} + {selectedHeroAttributes.int.gain}</strong>
                  </article>
                </div>
              ) : (
                <div className="hero-browser-identity-grid">
                  <article className="hero-browser-identity-card">
                    <span>{introText.laneLabel}</span>
                    <strong>{selectedHero.lane}</strong>
                  </article>
                  <article className="hero-browser-identity-card">
                    <span>{introText.difficultyLabel}</span>
                    <strong>{selectedHero.difficulty}</strong>
                  </article>
                  <article className="hero-browser-identity-card">
                    <span>{introText.specialtyLabel}</span>
                    <strong>{selectedHero.specialty}</strong>
                  </article>
                  <article className="hero-browser-identity-card">
                    <span>{introText.timingLabel}</span>
                    <strong>{selectedHero.timing}</strong>
                  </article>
                </div>
              )}
            </div>
          </article>

          <aside className="hero-browser-side">
            <section className="panel hero-browser-side-panel">
              <div className="hero-browser-side-head">
                <p className="section-kicker">{pageText.rolesTitle}</p>
                <h4>{detailCopy.profileTitle}</h4>
              </div>

              <div className="hero-browser-tag-row">
                {selectedHeroRoles.map((role) => (
                  <span className="hero-browser-tag" key={`${selectedHero.name}-${role}`}>
                    {role}
                  </span>
                ))}
              </div>

              <div className="hero-browser-side-meta">
                <span>{detailCopy.complexityLabel}</span>
                <strong>{selectedHeroComplexity} / 3</strong>
              </div>
              <div className="hero-browser-side-meta">
                <span>{pageText.combatLabel}</span>
                <strong>{selectedHeroSubtitle}</strong>
              </div>

              <div className="hero-browser-facet-list">
                <div className="hero-browser-side-head">
                  <p className="section-kicker">{detailCopy.facetsTitle}</p>
                  <h4>{detailCopy.attributesTitle}</h4>
                </div>
                {selectedHeroDetail?.facets.length ? (
                  selectedHeroDetail.facets.map((facet) => (
                    <article className="hero-browser-facet-card" key={facet.name}>
                      <strong>{facet.displayName}</strong>
                      <p>{facet.description}</p>
                    </article>
                  ))
                ) : (
                  <p className="hero-browser-side-copy">{detailCopy.facetsEmpty}</p>
                )}
              </div>
            </section>

            <section className="panel hero-browser-side-panel">
              <div className="hero-browser-side-head">
                <p className="section-kicker">{pageText.skillsTitle}</p>
                <h4>{introText.skillsLabel}</h4>
              </div>

              <div className="hero-browser-skill-tablist" role="tablist" aria-label={pageText.skillsTitle}>
                {resolvedSkills.map((skill, index) => {
                  const isActive = selectedSkill?.key === skill.key;

                  return (
                    <button
                      aria-selected={isActive}
                      className={`hero-browser-skill-tab${isActive ? " active" : ""}`}
                      key={`${selectedHero.name}-${skill.key}`}
                      onClick={() => setSelectedSkillKey(skill.key)}
                      role="tab"
                      type="button"
                    >
                      <SkillIcon
                        className="hero-browser-skill-tab-icon"
                        glyph={getSkillGlyph(skill.name)}
                        iconUrl={getSkillIconUrl(selectedHeroImage, skill.key)}
                      />
                      <span className="hero-browser-skill-tab-copy">
                        <small>{String(index + 1).padStart(2, "0")}</small>
                        <strong>{skill.name}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedSkill && (
                <article className="hero-browser-skill-focus" role="tabpanel">
                  <div className="hero-browser-skill-focus-head">
                    <SkillIcon
                      className="hero-browser-skill-focus-icon"
                      glyph={getSkillGlyph(selectedSkill.name)}
                      iconUrl={getSkillIconUrl(selectedHeroImage, selectedSkill.key)}
                    />
                    <div>
                      <small>{pageText.skillsTitle}</small>
                      <strong>{selectedSkill.name}</strong>
                    </div>
                  </div>
                  <p>{selectedSkill.detail}</p>
                  <div className="hero-browser-skill-flags">
                    {selectedSkill.isInnate ? <span className="hero-browser-tag">{detailCopy.innateLabel}</span> : null}
                    {selectedSkill.isGrantedByScepter ? (
                      <span className="hero-browser-tag">{detailCopy.scepterLabel}</span>
                    ) : null}
                    {selectedSkill.isGrantedByShard ? (
                      <span className="hero-browser-tag">{detailCopy.shardLabel}</span>
                    ) : null}
                  </div>
                  {selectedSkill.notes.length > 0 ? (
                    <div className="hero-browser-skill-note-list">
                      {selectedSkill.notes.map((note) => (
                        <p key={`${selectedSkill.key}-${note}`}>{note}</p>
                      ))}
                    </div>
                  ) : null}
                </article>
              )}
            </section>
          </aside>
        </section>
      ) : (
        !isLoadingAvatars && <p className="muted">{pageText.empty}</p>
      )}

      <section className="panel hero-browser-roster">
        <div className="hero-browser-roster-head">
          <div>
            <p className="section-kicker">{pageText.kicker}</p>
            <h3>{pageText.rosterTitle}</h3>
          </div>
          <div className="hero-browser-roster-controls">
            <p className="muted">{pageText.rosterHint}</p>
            <section className="panel hero-browser-controls">
              <div className="hero-browser-filter-row">
                {FILTER_ORDER.map((filterKey) => (
                  <button
                    className={`hero-browser-filter tone-${getFilterTone(filterKey)}${activeFilter === filterKey ? " active" : ""}`}
                    key={filterKey}
                    onClick={() => setActiveFilter(filterKey)}
                    type="button"
                  >
                    <span className={`hero-browser-filter-icon tone-${getFilterTone(filterKey)}`} aria-hidden="true">
                      <span className={`hero-browser-filter-glyph glyph-${getFilterTone(filterKey)}`}>
                        <span className="glyph-core" />
                        <span className="glyph-orbit orbit-a" />
                        <span className="glyph-orbit orbit-b" />
                        <span className="glyph-orbit orbit-c" />
                      </span>
                    </span>
                    <span className="hero-browser-filter-copy">
                      <span>{pageText.filters[filterKey].label}</span>
                      <strong>{heroCounts[filterKey]}</strong>
                    </span>
                  </button>
                ))}
              </div>

              <div className="hero-browser-search-row">
                <input
                  className="hero-browser-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={pageText.search}
                  value={query}
                />
                <p className="hero-browser-search-hint">{selectedFilter.hint}</p>
              </div>
            </section>
          </div>
        </div>

        <div className="hero-browser-roster-grid">
          {visibleHeroes.map((hero, index) => {
            const heroImage = hero.image ?? HERO_IMAGE_FALLBACKS[hero.name];
            const heroVideo = getHeroRenderVideoUrl(heroImage);
            const isSelected = hero.name === selectedHero?.name;
            const isPreviewing = hoveredHeroName === hero.name || isSelected;
            const cardStyle = {
              "--hero-card-accent": hero.accent,
              "--hero-enter-delay": `${Math.min(index, 15) * 45}ms`
            } as CSSProperties;

            return (
              <button
                className={`hero-browser-card${isSelected ? " selected" : ""}${isPreviewing ? " previewing" : ""}`}
                key={hero.name}
                onBlur={() => setHoveredHeroName((current) => (current === hero.name ? "" : current))}
                onFocus={() => setHoveredHeroName(hero.name)}
                onMouseEnter={() => setHoveredHeroName(hero.name)}
                onMouseLeave={() => setHoveredHeroName((current) => (current === hero.name ? "" : current))}
                onClick={() => setSelectedHeroName(hero.name)}
                style={cardStyle}
                type="button"
              >
                {heroImage ? (
                  <img alt={hero.name} className="hero-browser-card-image" src={heroImage} />
                ) : (
                  <span className="hero-browser-card-placeholder">{hero.name.slice(0, 2)}</span>
                )}
                {heroVideo && isPreviewing ? (
                  <video
                    aria-hidden="true"
                    autoPlay
                    className="hero-browser-card-video"
                    key={`${hero.name}-${isPreviewing ? "preview" : "idle"}`}
                    loop
                    muted
                    playsInline
                    poster={heroImage}
                    preload="metadata"
                  >
                    <source src={heroVideo} type="video/webm" />
                  </video>
                ) : null}
                <span className="hero-browser-card-shadow" />
                <span className={`hero-browser-card-mark tone-${getFilterTone(hero.primaryAttr ?? "unknown")}`} />
                <span className="hero-browser-card-copy">
                  <strong>{hero.displayName ?? hero.localizedName ?? hero.name}</strong>
                  <span>{hero.roleLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function formatAbilityDetail(ability: HeroAbilityDetail): string {
  const parts = [ability.description, ability.lore, ...ability.notes].filter(Boolean);
  return parts.join(" ");
}
