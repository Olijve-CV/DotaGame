import type { Article, Language } from "@dotagame/contracts";
import { withCache } from "./cache.js";

const STEAM_CURRENT_PLAYERS_URL =
  "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=570";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SteamCurrentPlayersResponse {
  response?: {
    player_count?: number;
  };
}

function liveSourcesEnabled(): boolean {
  if (process.env.USE_LIVE_SOURCES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function formatCount(value: number, language: Language): string {
  return new Intl.NumberFormat(language).format(value);
}

export async function fetchSteamPlayerActivityArticles(language: Language): Promise<Article[]> {
  if (!liveSourcesEnabled()) {
    return [];
  }

  const playerCount = await withCache("steam-current-players", CACHE_TTL_MS, async () => {
    const response = await fetch(STEAM_CURRENT_PLAYERS_URL);
    if (!response.ok) {
      throw new Error(`STEAM_CURRENT_PLAYERS_FAILED:${response.status}`);
    }

    const data = (await response.json()) as SteamCurrentPlayersResponse;
    return data.response?.player_count ?? 0;
  });

  const publishedAt = new Date().toISOString();

  return [
    {
      id: `steam-player-activity-${language}`,
      category: "news",
      language,
      source: "Steam Activity",
      sourceUrl: STEAM_CURRENT_PLAYERS_URL,
      title: language === "zh-CN" ? "Steam 在线人数快照" : "Steam Live Player Snapshot",
      summary:
        language === "zh-CN"
          ? `Steam 官方接口当前显示 Dota 2 在线人数约为 ${formatCount(playerCount, language)}。`
          : `Steam's official player-count endpoint currently reports about ${formatCount(playerCount, language)} Dota 2 players online.`,
      tags: ["steam", "players", "live-source"],
      publishedAt
    }
  ];
}
