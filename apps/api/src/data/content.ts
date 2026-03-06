import type { Article, PatchNote, Tournament } from "@dotagame/contracts";

export const articles: Article[] = [
  {
    id: "news-ti-qualifier-zh",
    category: "tournament",
    language: "zh-CN",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com",
    title: "TI 预选赛分组公布：东西赛区焦点对决",
    summary: "官方公布了国际邀请赛预选赛分组与赛程，多个新阵容首次亮相。",
    tags: ["TI", "预选赛", "赛事"],
    publishedAt: "2026-03-01T08:00:00.000Z"
  },
  {
    id: "news-ti-qualifier-en",
    category: "tournament",
    language: "en-US",
    source: "Dota2 Official",
    sourceUrl: "https://www.dota2.com",
    title: "TI Regional Qualifiers Announced",
    summary: "Valve published regional groupings and schedule highlights for TI qualifiers.",
    tags: ["TI", "Qualifiers", "Esports"],
    publishedAt: "2026-03-01T08:00:00.000Z"
  },
  {
    id: "news-new-player-zh",
    category: "guide",
    language: "zh-CN",
    source: "Dota2 Wiki CN",
    sourceUrl: "https://dota2.fandom.com",
    title: "新手入门：对线期 10 分钟该做什么",
    summary: "从补刀、拉野、控符到 TP 支援，帮助新手建立早期节奏。",
    tags: ["入门", "对线", "教学"],
    publishedAt: "2026-02-26T03:00:00.000Z"
  },
  {
    id: "news-new-player-en",
    category: "guide",
    language: "en-US",
    source: "Dota2 Wiki",
    sourceUrl: "https://dota2.fandom.com",
    title: "Beginner Guide: The First 10 Minutes",
    summary: "A practical laning checklist for farming, rune control, and rotations.",
    tags: ["beginner", "laning", "guide"],
    publishedAt: "2026-02-26T03:00:00.000Z"
  },
  {
    id: "news-meta-shift-zh",
    category: "news",
    language: "zh-CN",
    source: "DotaTV Insight",
    sourceUrl: "https://example.com/dotatv",
    title: "版本节奏转向：中后期团战英雄回暖",
    summary: "分析近期职业赛中的英雄优先级变化以及阵容构筑趋势。",
    tags: ["版本", "阵容", "职业赛"],
    publishedAt: "2026-03-04T12:30:00.000Z"
  },
  {
    id: "news-meta-shift-en",
    category: "news",
    language: "en-US",
    source: "DotaTV Insight",
    sourceUrl: "https://example.com/dotatv",
    title: "Meta Shift: Teamfight Cores Return",
    summary: "Recent pro matches show stronger late-game scaling and objective timing.",
    tags: ["meta", "draft", "pro scene"],
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
    summary: "对 20+ 英雄和多个中立道具进行平衡调整，修复了若干技能交互问题。",
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

export const tournaments: Tournament[] = [
  {
    id: "tour-shanghai-open-zh",
    language: "zh-CN",
    source: "Esports League",
    sourceUrl: "https://example.com/esports",
    title: "上海春季公开赛",
    summary: "16 支队伍参赛，双败淘汰赛制，冠军将获得国际赛资格积分。",
    tags: ["赛事", "公开赛", "积分"],
    publishedAt: "2026-03-02T05:00:00.000Z",
    region: "CN",
    startDate: "2026-03-10",
    endDate: "2026-03-16",
    status: "upcoming"
  },
  {
    id: "tour-shanghai-open-en",
    language: "en-US",
    source: "Esports League",
    sourceUrl: "https://example.com/esports",
    title: "Shanghai Spring Open",
    summary: "A 16-team double-elimination event with qualification points on the line.",
    tags: ["tournament", "open", "points"],
    publishedAt: "2026-03-02T05:00:00.000Z",
    region: "CN",
    startDate: "2026-03-10",
    endDate: "2026-03-16",
    status: "upcoming"
  }
];
