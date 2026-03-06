import type { Language, Tournament } from "@dotagame/contracts";
import { withCache } from "./cache.js";

const OPEN_DOTA_PRO_MATCHES = "https://api.opendota.com/api/proMatches";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ProMatch {
  leagueid?: number;
  league_name?: string;
  start_time?: number;
}

interface LeagueAgg {
  leagueId: number;
  name: string;
  earliest: number;
  latest: number;
  matchCount: number;
}

function liveSourcesEnabled(): boolean {
  if (process.env.USE_LIVE_SOURCES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function inferRegion(leagueName: string): string {
  const value = leagueName.toLowerCase();
  if (/(china|cn|chinese)/.test(value)) {
    return "CN";
  }
  if (/(sea|southeast asia)/.test(value)) {
    return "SEA";
  }
  if (/(europe|eu|cis)/.test(value)) {
    return "EU";
  }
  if (/(north america|na)/.test(value)) {
    return "NA";
  }
  if (/(south america|sa)/.test(value)) {
    return "SA";
  }
  return "Global";
}

function toTournament(agg: LeagueAgg, language: Language): Tournament {
  const now = Date.now();
  const endTimestamp = agg.latest * 1000;
  const status: Tournament["status"] =
    now - endTimestamp < 3 * 24 * 60 * 60 * 1000 ? "ongoing" : "completed";

  const localizedSummary =
    language === "zh-CN"
      ? `Recent pro activity: ${agg.matchCount} matches in the last feed window.`
      : `${agg.matchCount} recent pro matches tracked from OpenDota.`;

  return {
    id: `od-league-${agg.leagueId}-${language}`,
    language,
    source: "OpenDota",
    sourceUrl: `https://www.opendota.com/leagues/${agg.leagueId}`,
    title: agg.name,
    summary: localizedSummary,
    tags: ["pro", "league", "live-source"],
    publishedAt: new Date(agg.latest * 1000).toISOString(),
    region: inferRegion(agg.name),
    startDate: new Date(agg.earliest * 1000).toISOString().slice(0, 10),
    endDate: new Date(agg.latest * 1000).toISOString().slice(0, 10),
    status
  };
}

export async function fetchOpenDotaTournaments(language: Language): Promise<Tournament[]> {
  if (!liveSourcesEnabled()) {
    return [];
  }

  const groups = await withCache("opendota-tournaments", CACHE_TTL_MS, async () => {
    const response = await fetch(OPEN_DOTA_PRO_MATCHES);
    if (!response.ok) {
      throw new Error(`OPEN_DOTA_FAILED:${response.status}`);
    }

    const matches = (await response.json()) as ProMatch[];
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - 30 * 24 * 60 * 60;
    const map = new Map<number, LeagueAgg>();

    for (const match of matches) {
      if (!match.leagueid || !match.league_name || !match.start_time) {
        continue;
      }
      if (match.start_time < cutoff) {
        continue;
      }

      const current = map.get(match.leagueid);
      if (!current) {
        map.set(match.leagueid, {
          leagueId: match.leagueid,
          name: match.league_name,
          earliest: match.start_time,
          latest: match.start_time,
          matchCount: 1
        });
      } else {
        current.earliest = Math.min(current.earliest, match.start_time);
        current.latest = Math.max(current.latest, match.start_time);
        current.matchCount += 1;
      }
    }

    return [...map.values()]
      .filter((league) => league.matchCount >= 2)
      .sort((a, b) => b.latest - a.latest)
      .slice(0, 12);
  });

  return groups.map((group) => toTournament(group, language));
}
