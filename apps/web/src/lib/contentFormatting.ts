import type { ContentCategory, Language, Tournament } from "@dotagame/contracts";

type FavoriteContentType = "article" | "patch" | "tournament";

const categoryLabels: Record<Language, Record<ContentCategory | FavoriteContentType, string>> = {
  "zh-CN": {
    news: "新闻",
    guide: "攻略",
    tournament: "赛事",
    patch: "版本",
    article: "文章"
  },
  "en-US": {
    news: "News",
    guide: "Guide",
    tournament: "Tournament",
    patch: "Patch",
    article: "Article"
  }
};

const statusLabels: Record<Language, Record<Tournament["status"], string>> = {
  "zh-CN": {
    upcoming: "即将开始",
    ongoing: "进行中",
    completed: "已结束"
  },
  "en-US": {
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    completed: "Completed"
  }
};

export function formatContentDate(value: string, locale: Language) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatContentDateTime(value: string, locale: Language) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateRange(start: string, end: string, locale: Language) {
  return `${formatContentDate(start, locale)} - ${formatContentDate(end, locale)}`;
}

export function getCategoryLabel(
  category: ContentCategory | FavoriteContentType,
  locale: Language
) {
  return categoryLabels[locale][category];
}

export function getTournamentStatusLabel(status: Tournament["status"], locale: Language) {
  return statusLabels[locale][status];
}
