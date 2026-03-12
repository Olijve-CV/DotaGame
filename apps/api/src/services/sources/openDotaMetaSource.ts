import type { Article, Language } from "@dotagame/contracts";
import { withCache } from "./cache.js";

const OPEN_DOTA_HERO_STATS_URL = "https://api.opendota.com/api/heroStats";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface OpenDotaHeroStat {
  id: number;
  localized_name?: string;
  roles?: string[];
  pro_pick?: number;
  pro_win?: number;
  pro_ban?: number;
  pub_pick?: number;
  pub_win?: number;
}

function liveSourcesEnabled(): boolean {
  if (process.env.USE_LIVE_SOURCES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function percent(wins: number, picks: number): string {
  if (picks <= 0) {
    return "0.0%";
  }

  return `${((wins / picks) * 100).toFixed(1)}%`;
}

function formatCount(value: number, language: Language): string {
  return new Intl.NumberFormat(language).format(value);
}

function toProMetaArticle(hero: OpenDotaHeroStat, language: Language, publishedAt: string): Article {
  const heroName = hero.localized_name ?? `Hero ${hero.id}`;
  const proPick = hero.pro_pick ?? 0;
  const proBan = hero.pro_ban ?? 0;
  const proWin = hero.pro_win ?? 0;
  const winRate = percent(proWin, proPick);
  const roles = hero.roles?.slice(0, 2) ?? [];

  return {
    id: `od-meta-pro-${hero.id}-${language}`,
    category: "news",
    language,
    source: "OpenDota Meta",
    sourceUrl: `https://www.opendota.com/heroes/${hero.id}`,
    title:
      language === "zh-CN"
        ? `OpenDota 职业热度观察：${heroName}`
        : `OpenDota Pro Meta Watch: ${heroName}`,
    summary:
      language === "zh-CN"
        ? `${heroName} 在最近统计窗口中拥有 ${formatCount(proPick, language)} 次职业选用、${formatCount(proBan, language)} 次禁用，职业胜率 ${winRate}。`
        : `${heroName} logged ${formatCount(proPick, language)} pro picks, ${formatCount(proBan, language)} bans, and a ${winRate} pro win rate in the current OpenDota window.`,
    tags: [...roles, "meta", "pro", "live-source"],
    publishedAt
  };
}

function toPubTrendArticle(hero: OpenDotaHeroStat, language: Language, publishedAt: string): Article {
  const heroName = hero.localized_name ?? `Hero ${hero.id}`;
  const pubPick = hero.pub_pick ?? 0;
  const pubWin = hero.pub_win ?? 0;
  const winRate = percent(pubWin, pubPick);
  const roles = hero.roles?.slice(0, 2) ?? [];

  return {
    id: `od-meta-pub-${hero.id}-${language}`,
    category: "guide",
    language,
    source: "OpenDota Trends",
    sourceUrl: `https://www.opendota.com/heroes/${hero.id}`,
    title:
      language === "zh-CN"
        ? `OpenDota 路人胜率观察：${heroName}`
        : `OpenDota Public Trend Watch: ${heroName}`,
    summary:
      language === "zh-CN"
        ? `${heroName} 在最近公开对局样本中累计 ${formatCount(pubPick, language)} 次出场，胜率 ${winRate}，适合作为当前版本观察对象。`
        : `${heroName} shows ${formatCount(pubPick, language)} public matches with a ${winRate} win rate in the latest OpenDota sample, making it a useful patch-watch target.`,
    tags: [...roles, "guide", "winrate", "live-source"],
    publishedAt
  };
}

async function fetchRawHeroStats(): Promise<OpenDotaHeroStat[]> {
  if (!liveSourcesEnabled()) {
    return [];
  }

  return withCache("opendota-hero-stats", CACHE_TTL_MS, async () => {
    const response = await fetch(OPEN_DOTA_HERO_STATS_URL);
    if (!response.ok) {
      throw new Error(`OPEN_DOTA_HERO_STATS_FAILED:${response.status}`);
    }

    return (await response.json()) as OpenDotaHeroStat[];
  });
}

export async function fetchOpenDotaMetaArticles(language: Language): Promise<Article[]> {
  const heroes = await fetchRawHeroStats();
  const publishedAt = new Date().toISOString();

  const proMeta = [...heroes]
    .filter((hero) => (hero.pro_pick ?? 0) >= 10)
    .sort((left, right) => ((right.pro_pick ?? 0) + (right.pro_ban ?? 0)) - ((left.pro_pick ?? 0) + (left.pro_ban ?? 0)))
    .slice(0, 3)
    .map((hero) => toProMetaArticle(hero, language, publishedAt));

  const publicTrends = [...heroes]
    .filter((hero) => (hero.pub_pick ?? 0) >= 100000)
    .sort((left, right) => (right.pub_win ?? 0) / (right.pub_pick ?? 1) - (left.pub_win ?? 0) / (left.pub_pick ?? 1))
    .slice(0, 3)
    .map((hero) => toPubTrendArticle(hero, language, publishedAt));

  return [...proMeta, ...publicTrends];
}
