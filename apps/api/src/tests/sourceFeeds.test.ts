import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpenDotaMetaArticles } from "../services/sources/openDotaMetaSource.js";
import { fetchSteamPlayerActivityArticles } from "../services/sources/steamMetricsSource.js";

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
});
