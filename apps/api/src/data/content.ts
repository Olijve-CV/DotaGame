import type { Article, PatchNote, Tournament } from "@dotagame/contracts";

export const articles: Article[] = [
  {
    id: "news-ti-qualifier-zh",
    category: "news",
    language: "zh-CN",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/news",
    title: "Dota 2 官方新闻中心",
    summary: "浏览官方公告、赛事动态和开发者更新的统一入口。",
    tags: ["官方", "新闻", "公告"],
    publishedAt: "2026-03-01T08:00:00.000Z"
  },
  {
    id: "news-ti-qualifier-en",
    category: "news",
    language: "en-US",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/news",
    title: "Dota 2 News Hub",
    summary: "A stable entry point for official announcements, event coverage, and developer updates.",
    tags: ["official", "news", "announcements"],
    publishedAt: "2026-03-01T08:00:00.000Z"
  },
  {
    id: "news-new-player-zh",
    category: "guide",
    language: "zh-CN",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/heroes",
    title: "Dota 2 英雄与定位概览",
    summary: "从官方英雄页面快速了解定位、技能类型与基础阵容分工。",
    tags: ["入门", "英雄", "定位"],
    publishedAt: "2026-02-26T03:00:00.000Z"
  },
  {
    id: "news-new-player-en",
    category: "guide",
    language: "en-US",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/heroes",
    title: "Dota 2 Heroes and Roles Overview",
    summary: "A stable official reference for hero roles, abilities, and lineup basics.",
    tags: ["beginner", "heroes", "roles"],
    publishedAt: "2026-02-26T03:00:00.000Z"
  },
  {
    id: "news-meta-shift-zh",
    category: "news",
    language: "zh-CN",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/patches",
    title: "Dota 2 游戏更新归档",
    summary: "集中查看官方版本改动与长期平衡更新入口。",
    tags: ["版本", "更新", "平衡"],
    publishedAt: "2026-03-04T12:30:00.000Z"
  },
  {
    id: "news-meta-shift-en",
    category: "news",
    language: "en-US",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/patches",
    title: "Dota 2 Gameplay Update Archive",
    summary: "A stable official source for gameplay updates, balance notes, and patch history.",
    tags: ["patch", "updates", "balance"],
    publishedAt: "2026-03-04T12:30:00.000Z"
  }
];

export const patchNotes: PatchNote[] = [
  {
    id: "patch-7-39a-zh",
    version: "7.39a",
    language: "zh-CN",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/patches",
    title: "7.39a 平衡性更新",
    summary: "对 20+ 英雄和多个中立道具进行平衡调整，并修复了若干技能交互问题。",
    tags: ["补丁", "平衡", "英雄"],
    publishedAt: "2026-02-28T01:20:00.000Z"
  },
  {
    id: "patch-7-39a-en",
    version: "7.39a",
    language: "en-US",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com/patches",
    title: "Patch 7.39a Gameplay Update",
    summary: "Balance changes across heroes and neutral items, plus gameplay bug fixes.",
    tags: ["patch", "balance", "heroes"],
    publishedAt: "2026-02-28T01:20:00.000Z"
  }
];

export const tournaments: Tournament[] = [];
