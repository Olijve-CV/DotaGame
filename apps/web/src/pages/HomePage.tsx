import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Article, Language, Tournament, UserProfile } from "@dotagame/contracts";
import { addFavorite, fetchArticles, fetchTournaments } from "../lib/api";
import {
  formatContentDate,
  formatDateRange,
  getCategoryLabel,
  getTournamentStatusLabel
} from "../lib/contentFormatting";

export type IntelPageKind = "news" | "guide" | "tournament";

type DisplayItem = Article | Tournament;

type PageContentCopy = {
  title: string;
  summary: string;
  search: string;
  filtersTitle: string;
  filtersHint: string;
  countLabel: string;
  featuredLabel: string;
  feedTitle: string;
  feedSubtitle: string;
  emptyFeed: string;
  primaryAction: string;
  primaryTo: string;
  secondaryAction: string;
  secondaryTo: string;
  summaryLabel: string;
  pageLabel: string;
  prevPage: string;
  nextPage: string;
};

const HOME_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const ITEMS_PER_PAGE = 7;

const labels = {
  "zh-CN": {
    kicker: "Intel Desk",
    readSource: "查看来源",
    favorite: "收藏",
    needLogin: "登录后才能收藏内容。",
    loading: "正在载入最新内容...",
    visibleItems: "当前可见",
    latestUpdate: "最近更新",
    sourceCount: "来源数",
    autoRefresh: "每 10 分钟自动刷新",
    pulseTag: "实时侦测中",
    pages: {
      news: {
        title: "新闻页只看新闻，不再混入攻略和赛事。",
        summary: "这里专门追新闻信号，只保留资讯本身，方便你快速扫当天重要更新。",
        search: "搜索新闻标题或标签",
        filtersTitle: "筛选新闻流",
        filtersHint: "只在新闻集合里搜索和浏览，不再混入其他类型内容。",
        countLabel: "新闻数",
        featuredLabel: "头条新闻",
        feedTitle: "新闻列表",
        feedSubtitle: "当前页面只展示新闻条目，保持资讯流足够干净。",
        emptyFeed: "当前没有可展示的新闻。",
        primaryAction: "打开智能问答",
        primaryTo: "/chat",
        secondaryAction: "查看新手入门",
        secondaryTo: "/intro",
        summaryLabel: "新闻状态",
        pageLabel: "页码",
        prevPage: "上一页",
        nextPage: "下一页"
      },
      guide: {
        title: "攻略页只看攻略，把学习内容和资讯流彻底拆开。",
        summary: "这里专门整理教学与学习路线，只保留攻略内容，读起来不会被新闻节奏打断。",
        search: "搜索攻略标题或标签",
        filtersTitle: "筛选攻略内容",
        filtersHint: "只浏览攻略和学习向内容，不再混看新闻和赛事。",
        countLabel: "攻略数",
        featuredLabel: "重点攻略",
        feedTitle: "攻略列表",
        feedSubtitle: "当前页面只展示攻略条目，便于连续学习和查阅。",
        emptyFeed: "当前没有可展示的攻略。",
        primaryAction: "查看新手入门",
        primaryTo: "/intro",
        secondaryAction: "打开英雄图谱",
        secondaryTo: "/heroes",
        summaryLabel: "学习进度",
        pageLabel: "页码",
        prevPage: "上一页",
        nextPage: "下一页"
      },
      tournament: {
        title: "赛事页只看赛事，把赛场信息单独放到一页里。",
        summary: "这里专门追赛事安排和状态，不再被新闻或攻略内容稀释。",
        search: "搜索赛事标题或标签",
        filtersTitle: "筛选赛事追踪",
        filtersHint: "只浏览赛事相关内容，方便集中看赛程、状态和来源。",
        countLabel: "赛事数",
        featuredLabel: "焦点赛事",
        feedTitle: "赛事列表",
        feedSubtitle: "当前页面只展示赛事条目，避免和其他内容混排。",
        emptyFeed: "当前没有可展示的赛事。",
        primaryAction: "打开智能问答",
        primaryTo: "/chat",
        secondaryAction: "查看新手入门",
        secondaryTo: "/intro",
        summaryLabel: "赛场状态",
        pageLabel: "页码",
        prevPage: "上一页",
        nextPage: "下一页"
      }
    } satisfies Record<IntelPageKind, PageContentCopy>
  },
  "en-US": {
    kicker: "Intel Desk",
    readSource: "Open source",
    favorite: "Favorite",
    needLogin: "Please login before saving favorites.",
    loading: "Loading the current field...",
    visibleItems: "Visible Now",
    latestUpdate: "Latest Update",
    sourceCount: "Sources",
    autoRefresh: "Auto refresh every 10 min",
    pulseTag: "Live monitoring",
    pages: {
      news: {
        title: "The news page now stays news-only.",
        summary: "This view tracks information updates only, so you can scan the latest news without guide or tournament noise.",
        search: "Search news titles or tags",
        filtersTitle: "Filter the news feed",
        filtersHint: "Search and scan only news items here. Guides and tournaments are split out.",
        countLabel: "News Items",
        featuredLabel: "Lead Story",
        feedTitle: "News List",
        feedSubtitle: "This page only shows news entries so the intel stream stays clean.",
        emptyFeed: "No news is available right now.",
        primaryAction: "Ask Agent Chat",
        primaryTo: "/chat",
        secondaryAction: "Open Starter Guide",
        secondaryTo: "/intro",
        summaryLabel: "News Status",
        pageLabel: "Page",
        prevPage: "Prev",
        nextPage: "Next"
      },
      guide: {
        title: "The guide page now stays guide-only.",
        summary: "This view keeps learning content separate from headlines, so you can study without the live feed getting in the way.",
        search: "Search guide titles or tags",
        filtersTitle: "Filter guide content",
        filtersHint: "Browse only guide material here. News and tournaments are shown on their own pages.",
        countLabel: "Guide Items",
        featuredLabel: "Lead Guide",
        feedTitle: "Guide List",
        feedSubtitle: "This page only shows guide entries so the learning route stays focused.",
        emptyFeed: "No guides are available right now.",
        primaryAction: "Open Starter Guide",
        primaryTo: "/intro",
        secondaryAction: "Open Hero Atlas",
        secondaryTo: "/heroes",
        summaryLabel: "Learning Status",
        pageLabel: "Page",
        prevPage: "Prev",
        nextPage: "Next"
      },
      tournament: {
        title: "The tournament page now stays tournament-only.",
        summary: "This view tracks event schedules and statuses without mixing in news or learning content.",
        search: "Search tournament titles or tags",
        filtersTitle: "Filter tournament tracking",
        filtersHint: "Browse only tournament entries here for a cleaner event board.",
        countLabel: "Tournament Items",
        featuredLabel: "Tournament Focus",
        feedTitle: "Tournament List",
        feedSubtitle: "This page only shows tournament entries so the event board stays readable.",
        emptyFeed: "No tournaments are available right now.",
        primaryAction: "Ask Agent Chat",
        primaryTo: "/chat",
        secondaryAction: "Open Starter Guide",
        secondaryTo: "/intro",
        summaryLabel: "Event Status",
        pageLabel: "Page",
        prevPage: "Prev",
        nextPage: "Next"
      }
    } satisfies Record<IntelPageKind, PageContentCopy>
  }
};

function statusTone(status: Tournament["status"]) {
  switch (status) {
    case "ongoing":
      return "live";
    case "upcoming":
      return "upcoming";
    default:
      return "completed";
  }
}

function isTournamentItem(item: DisplayItem): item is Tournament {
  return "startDate" in item;
}

function itemMeta(item: DisplayItem, locale: Language) {
  if (isTournamentItem(item)) {
    return `${item.source} / ${formatDateRange(item.startDate, item.endDate, locale)}`;
  }

  return `${getCategoryLabel(item.category, locale)} / ${item.source} / ${formatContentDate(item.publishedAt, locale)}`;
}

export function HomePage(props: {
  kind: IntelPageKind;
  locale: Language;
  token: string | null;
  onUserLoaded: (user: UserProfile | null, source?: "fetch" | "mutation") => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const baseText = useMemo(() => labels[props.locale], [props.locale]);
  const pageText = baseText.pages[props.kind];

  useEffect(() => {
    let active = true;

    const loadContent = async (options?: { silent?: boolean }) => {
      if (!options?.silent && !hasLoadedRef.current) {
        setLoading(true);
      }

      try {
        if (props.kind === "tournament") {
          const tournamentItems = await fetchTournaments(props.locale);
          if (!active) {
            return;
          }
          setTournaments(tournamentItems);
          setArticles([]);
        } else {
          const articleItems = await fetchArticles({ language: props.locale, category: props.kind });
          if (!active) {
            return;
          }
          setArticles(articleItems);
          setTournaments([]);
        }
        hasLoadedRef.current = true;
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadContent();
    const refreshTimer = window.setInterval(() => {
      void loadContent({ silent: true });
    }, HOME_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [props.kind, props.locale]);

  async function handleFavorite(contentType: "article" | "tournament", contentId: string) {
    if (!props.token) {
      window.alert(baseText.needLogin);
      return;
    }
    await addFavorite(props.token, { contentType, contentId });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const items = useMemo<DisplayItem[]>(() => {
    const sourceItems = props.kind === "tournament" ? tournaments : articles;
    const filtered = sourceItems.filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      const textMatch =
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      if (textMatch) {
        return true;
      }

      return isTournamentItem(item) ? item.region.toLowerCase().includes(normalizedQuery) : false;
    });
    return [...filtered].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    );
  }, [articles, normalizedQuery, props.kind, tournaments]);

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, props.kind, props.locale]);

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, items]);

  const featuredItem = pagedItems[0] ?? null;
  const storyDeck = featuredItem ? pagedItems.slice(1) : [];
  const latestUpdatedItem =
    [...items].sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())[0] ??
    null;
  const sourceCount = new Set(items.map((item) => item.source)).size;
  const summaryText =
    props.kind === "tournament"
      ? [
          `${baseText.pages.tournament.countLabel} ${items.length}`,
          `${baseText.sourceCount} ${sourceCount}`
        ].join(" / ")
      : `${baseText.sourceCount} ${sourceCount}`;

  return (
    <section className="stack home-page">
      <section className="panel home-hero-shell">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-hero-topline">
              <p className="section-kicker">{baseText.kicker}</p>
              <div className="home-live-strip">
                <span className="home-pulse-dot" aria-hidden="true" />
                <span className="home-live-pill">{baseText.pulseTag}</span>
                <span className="home-live-pill">{baseText.autoRefresh}</span>
              </div>
            </div>
            <h2>{pageText.title}</h2>
            <p className="home-command-summary">{pageText.summary}</p>

            <div className="home-stat-grid">
              <article className="home-stat-card">
                <span>{pageText.countLabel}</span>
                <strong>{items.length}</strong>
              </article>
              <article className="home-stat-card">
                <span>{baseText.sourceCount}</span>
                <strong>{sourceCount}</strong>
              </article>
              <article className="home-stat-card">
                <span>{baseText.latestUpdate}</span>
                <strong>
                  {latestUpdatedItem ? formatContentDate(latestUpdatedItem.publishedAt, props.locale) : "--"}
                </strong>
              </article>
            </div>

            <div className="home-command-actions">
              <Link className="primary-btn" to={pageText.primaryTo}>
                {pageText.primaryAction}
              </Link>
              <Link className="ghost-btn" to={pageText.secondaryTo}>
                {pageText.secondaryAction}
              </Link>
            </div>
          </div>

          <div className="home-hero-stack">
            <article className={`home-focus-card tone-${props.kind}`}>
              <div className="home-focus-head">
                <span>{pageText.featuredLabel}</span>
                {featuredItem ? <p className="meta">{itemMeta(featuredItem, props.locale)}</p> : null}
              </div>

              {featuredItem ? (
                <>
                  <h3>{featuredItem.title}</h3>
                  <p>{featuredItem.summary}</p>

                  {isTournamentItem(featuredItem) ? (
                    <span className={`status-pill ${statusTone(featuredItem.status)}`}>
                      {getTournamentStatusLabel(featuredItem.status, props.locale)}
                    </span>
                  ) : (
                    <div className="tag-list">
                      {featuredItem.tags.slice(0, 4).map((tag) => (
                        <span className="tag-chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-footer">
                    <a className="ghost-btn" href={featuredItem.sourceUrl} rel="noreferrer" target="_blank">
                      {baseText.readSource}
                    </a>
                    <button
                      onClick={() => handleFavorite(isTournamentItem(featuredItem) ? "tournament" : "article", featuredItem.id)}
                      type="button"
                    >
                      {baseText.favorite}
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">{loading ? baseText.loading : pageText.emptyFeed}</p>
              )}
            </article>

            <div className="home-mini-grid">
              <article className="home-mini-card">
                <span>{baseText.visibleItems}</span>
                <strong>{items.length}</strong>
                <p>{query ? `${pageText.search}: ${query}` : `${pageText.pageLabel} ${currentPage}/${totalPages}`}</p>
              </article>

              <article className="home-mini-card">
                <span>{pageText.summaryLabel}</span>
                <strong>{latestUpdatedItem ? latestUpdatedItem.source : "--"}</strong>
                <small>{summaryText}</small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="panel home-control-panel">
        <div className="filters-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3>{pageText.filtersTitle}</h3>
          </div>
          <p className="muted">{pageText.filtersHint}</p>
        </div>

        <div className="home-control-grid single-column">
          <div className="home-search-stack">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={pageText.search}
            />
          </div>

          <div className="home-summary-strip">
            <article className="home-summary-card">
              <span>{baseText.visibleItems}</span>
              <strong>{items.length}</strong>
              <p>{pageText.filtersHint}</p>
            </article>

            <article className="home-summary-card">
              <span>{baseText.sourceCount}</span>
              <strong>{sourceCount}</strong>
              <p>{summaryText}</p>
            </article>

            <article className="home-summary-card">
              <span>{baseText.latestUpdate}</span>
              <strong>
                {latestUpdatedItem ? formatContentDate(latestUpdatedItem.publishedAt, props.locale) : "--"}
              </strong>
              <p>{latestUpdatedItem ? latestUpdatedItem.source : pageText.emptyFeed}</p>
            </article>
          </div>
        </div>
      </section>

      <div className="home-board-layout single-column">
        <section className="panel home-story-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Signal Grid</p>
              <h3>{pageText.feedTitle}</h3>
            </div>
            <p className="muted">{pageText.feedSubtitle}</p>
          </div>

          {featuredItem ? (
            <>
              {storyDeck.length > 0 ? (
                <div className="home-story-list">
                  {storyDeck.map((item, index) => (
                    <article className="home-story-card" key={item.id}>
                      <div className="home-story-card-topline">
                        <span className="home-story-index">
                          {String((currentPage - 1) * ITEMS_PER_PAGE + index + 2).padStart(2, "0")}
                        </span>
                        <p className="meta">{itemMeta(item, props.locale)}</p>
                      </div>

                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>

                      {isTournamentItem(item) ? (
                        <span className={`status-pill ${statusTone(item.status)}`}>
                          {getTournamentStatusLabel(item.status, props.locale)}
                        </span>
                      ) : (
                        <div className="tag-list">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span className="tag-chip" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="card-footer">
                        <a className="text-btn" href={item.sourceUrl} rel="noreferrer" target="_blank">
                          {baseText.readSource}
                        </a>
                        <button
                          onClick={() => handleFavorite(isTournamentItem(item) ? "tournament" : "article", item.id)}
                          type="button"
                        >
                          {baseText.favorite}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="home-pagination">
                <button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
                  {pageText.prevPage}
                </button>
                <span>
                  {pageText.pageLabel} {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  type="button"
                >
                  {pageText.nextPage}
                </button>
              </div>
            </>
          ) : (
            !loading && (
              <article className="home-empty-card">
                <strong>{pageText.emptyFeed}</strong>
                <p>{pageText.filtersHint}</p>
              </article>
            )
          )}
        </section>
      </div>
    </section>
  );
}
