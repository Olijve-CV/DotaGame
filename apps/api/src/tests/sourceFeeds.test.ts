import { afterEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@dotagame/contracts";
import { sortArticlesForDisplay } from "../services/contentService.js";
import { fetchOpenDotaMetaArticles } from "../services/sources/openDotaMetaSource.js";
import { fetchSteamPlayerActivityArticles } from "../services/sources/steamMetricsSource.js";
import { fetchSteamArticles, fetchSteamPatchNotes } from "../services/sources/steamSource.js";

describe("live content sources", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLiveSources = process.env.USE_LIVE_SOURCES;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalLiveSources === undefined) {
      delete process.env.USE_LIVE_SOURCES;
    } else {
      process.env.USE_LIVE_SOURCES = originalLiveSources;
    }

    vi.unstubAllGlobals();
  });

  it("builds meta articles from OpenDota hero stats", async () => {
    process.env.NODE_ENV = "development";
    process.env.USE_LIVE_SOURCES = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: 11,
              localized_name: "Shadow Fiend",
              roles: ["Carry", "Nuker"],
              pro_pick: 166,
              pro_win: 85,
              pro_ban: 219,
              pub_pick: 656237,
              pub_win: 328106
            },
            {
              id: 129,
              localized_name: "Mars",
              roles: ["Initiator", "Durable"],
              pro_pick: 130,
              pro_win: 61,
              pro_ban: 89,
              pub_pick: 287368,
              pub_win: 135023
            },
            {
              id: 14,
              localized_name: "Pudge",
              roles: ["Disabler", "Initiator"],
              pro_pick: 71,
              pro_win: 41,
              pro_ban: 16,
              pub_pick: 840178,
              pub_win: 434849
            },
            {
              id: 5,
              localized_name: "Crystal Maiden",
              roles: ["Support", "Disabler"],
              pro_pick: 44,
              pro_win: 18,
              pro_ban: 2,
              pub_pick: 334485,
              pub_win: 168181
            }
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const items = await fetchOpenDotaMetaArticles("en-US");

    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.source === "OpenDota Meta")).toBe(true);
    expect(items.some((item) => item.category === "guide")).toBe(true);
    expect(items[0].sourceUrl).toContain("https://www.opendota.com/heroes/");
  });

  it("builds a steam player activity article from the official player count endpoint", async () => {
    process.env.NODE_ENV = "development";
    process.env.USE_LIVE_SOURCES = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ response: { player_count: 608754 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const items = await fetchSteamPlayerActivityArticles("en-US");

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Steam Activity");
    expect(items[0].sourceUrl).toContain("GetNumberOfCurrentPlayers");
    expect(items[0].summary).toContain("608,754");
  });

  it("keeps article ordering stable with official news ahead of generated snapshots", () => {
    const items: Article[] = [
      {
        id: "steam-activity",
        category: "news",
        language: "en-US",
        source: "Steam Activity",
        sourceUrl: "https://api.steampowered.com/example",
        title: "Steam Live Player Snapshot",
        summary: "Player count snapshot.",
        tags: ["steam"],
        publishedAt: "2026-03-13T08:10:00.000Z"
      },
      {
        id: "official-news",
        category: "news",
        language: "en-US",
        source: "Dota2 Official",
        sourceUrl: "https://www.dota2.com/newsentry/1",
        title: "Official Update",
        summary: "Official update.",
        tags: ["official"],
        publishedAt: "2026-03-13T08:00:00.000Z"
      },
      {
        id: "meta-news",
        category: "news",
        language: "en-US",
        source: "OpenDota Meta",
        sourceUrl: "https://www.opendota.com/heroes/1",
        title: "OpenDota Pro Meta Watch",
        summary: "Meta update.",
        tags: ["meta"],
        publishedAt: "2026-03-13T08:05:00.000Z"
      }
    ];

    expect(sortArticlesForDisplay(items).map((item) => item.id)).toEqual([
      "official-news",
      "meta-news",
      "steam-activity"
    ]);
  });

  it("builds official news articles from the dota2.com news page partner-events feed", async () => {
    process.env.NODE_ENV = "development";
    process.env.USE_LIVE_SOURCES = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            events: [
              {
                gid: "4238531900078333321",
                event_type: 13,
                event_name: "The International returns",
                rtime32_start_time: 1718064000,
                announcement_body: {
                  headline: "The International returns",
                  body: "<p>The road to TI begins with regional qualifiers and updated schedules.</p>",
                  tags: ["esports", "tournament"]
                }
              },
              {
                gid: "4312345678901234567",
                event_type: 12,
                event_name: "Gameplay Update 7.39c",
                rtime32_start_time: 1718150400,
                announcement_body: {
                  headline: "Gameplay Update 7.39c",
                  body: "<p>Balance changes across heroes and systems.</p>",
                  tags: ["patchnotes"]
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const items = await fetchSteamArticles("en-US");

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Dota2 Official");
    expect(items[0].sourceUrl).toBe("https://www.dota2.com/newsentry/4238531900078333321");
    expect(items[0].category).toBe("tournament");
  });

  it("requests schinese for zh-CN news and returns Chinese content", async () => {
    process.env.NODE_ENV = "development";
    process.env.USE_LIVE_SOURCES = "true";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toContain("l=schinese");

      return new Response(
        JSON.stringify({
          events: [
            {
              gid: "4238531900078333321",
              event_type: 13,
              event_name: "国际邀请赛回归",
              rtime32_start_time: 1718064000,
              announcement_body: {
                headline: "国际邀请赛回归",
                body: "<p>通往 TI 的道路将从地区预选赛重新开启。</p>",
                tags: ["赛事", "官方"]
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchSteamArticles("zh-CN");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Dota2 官方");
    expect(items[0].title).toBe("国际邀请赛回归");
    expect(items[0].summary).toContain("通往 TI 的道路");
    expect(items[0].language).toBe("zh-CN");
  });

  it("builds patch notes from the dota2.com news page updates feed", async () => {
    process.env.NODE_ENV = "development";
    process.env.USE_LIVE_SOURCES = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            events: [
              {
                gid: "4312345678901234567",
                event_type: 12,
                event_name: "Gameplay Update 7.39c",
                rtime32_start_time: 1718150400,
                announcement_body: {
                  headline: "Gameplay Update 7.39c",
                  body: "<p>Balance changes across heroes and systems.</p>",
                  tags: ["patchnotes"]
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const items = await fetchSteamPatchNotes("en-US");

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Dota2 Official");
    expect(items[0].sourceUrl).toBe("https://www.dota2.com/newsentry/4312345678901234567");
    expect(items[0].version).toBe("7.39c");
  });
});
