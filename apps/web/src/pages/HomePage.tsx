import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Article, Language, PatchNote, Tournament, UserProfile } from "@dotagame/contracts";
import { addFavorite, fetchArticles, fetchPatchNotes, fetchTournaments } from "../lib/api";
import {
  formatContentDate,
  formatDateRange,
  getCategoryLabel,
  getTournamentStatusLabel
} from "../lib/contentFormatting";

type CategoryFilter = "news" | "guide" | "tournament" | undefined;
const HOME_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const labels = {
  "zh-CN": {
    kicker: "Intel Desk",
    title: "先看清版本和赛场，再决定今天练什么",
    summary:
      "新闻、攻略、赛事和入门内容集中在一个页面里，先扫全局，再深入你关心的英雄、分路或版本问题。",
    search: "搜索标题或标签",
    filtersTitle: "筛选实时内容",
    filtersHint: "想更快扫版本或赛事时，可以先按分类和关键词收紧结果。",
    all: "全部",
    news: "新闻",
    guide: "攻略",
    tournament: "赛事",
    patchNotes: "版本追踪",
    tournaments: "赛事追踪",
    favorite: "收藏",
    needLogin: "登录后才能收藏内容。",
    loading: "正在载入最新内容...",
    emptyFeed: "当前没有可展示的内容。",
    exploreIntro: "查看新手入门",
    askAgent: "打开智能问答",
    latestPatch: "最新版本",
    nextTournament: "焦点赛事",
    activeFilter: "当前筛选",
    keywordIdle: "未设置关键词，正在浏览全部内容。",
    keywordPrefix: "关键词",
    readSource: "查看来源",
    feedTitle: "内容总览",
    feedSubtitle: "先看一条重点内容，再继续展开版本、赛事和学习路径。",
    sourceLabel: "来源",
    articleCount: "资讯数",
    patchCount: "版本项",
    tournamentCount: "赛事数",
    status: "状态",
    autoRefresh: "每 10 分钟自动刷新",
    pulseTag: "实时侦测中",
    prioritySignal: "重点信号",
    visibleItems: "当前可见",
    latestUpdate: "最近更新",
    coverage: "覆盖面",
    storyGridTitle: "实时情报流",
    storyGridSubtitle: "按优先级继续浏览新闻、攻略和赛事线索，快速判断今天先看什么。",
    learningPath: "学习路径",
    learningSummary: "先补基础，再切进英雄图谱和对局问答，能更快建立完整认知。",
    openHeroes: "打开英雄图谱",
    emptyEventsTitle: "赛事日历暂时空缺",
    emptyEventsSummary: "当前没有拉到可展示赛事，系统会继续自动刷新。"
  },
  "en-US": {
    kicker: "Intel Desk",
    title: "Read the patch, scene, and guides before you queue",
    summary:
      "News, guides, tournaments, and onboarding now live on one front page. Scan fast, then dive into the hero, lane, or patch question you actually need.",
    search: "Search titles or tags",
    filtersTitle: "Filter the live feed",
    filtersHint: "Tighten the stream by category or keyword when you want a faster patch or event scan.",
    all: "All",
    news: "News",
    guide: "Guides",
    tournament: "Tournaments",
    patchNotes: "Patch Watch",
    tournaments: "Event Watch",
    favorite: "Favorite",
    needLogin: "Please login before saving favorites.",
    loading: "Loading the current field...",
    emptyFeed: "No content is available right now.",
    exploreIntro: "Open Starter Guide",
    askAgent: "Ask Agent Chat",
    latestPatch: "Latest Patch Watch",
    nextTournament: "Tournament Focus",
    activeFilter: "Active Filter",
    keywordIdle: "No keyword set. You are browsing the full field.",
    keywordPrefix: "Keyword",
    readSource: "Open source",
    feedTitle: "Front Desk",
    feedSubtitle: "Lead with one key story, then branch into patches, tournaments, and learning paths.",
    sourceLabel: "Source",
    articleCount: "Stories",
    patchCount: "Patch Items",
    tournamentCount: "Tournament Items",
    status: "Status",
    autoRefresh: "Auto refresh every 10 min",
    pulseTag: "Live monitoring",
    prioritySignal: "Priority Signal",
    visibleItems: "Visible Now",
    latestUpdate: "Latest Update",
    coverage: "Coverage",
    storyGridTitle: "Signal Grid",
    storyGridSubtitle: "Keep scanning stories, guides, and event lines to decide what deserves attention next.",
    learningPath: "Learning Path",
    learningSummary: "Cover the fundamentals first, then jump into the hero atlas and match Q&A for faster context building.",
    openHeroes: "Open Hero Atlas",
    emptyEventsTitle: "Tournament board is quiet",
    emptyEventsSummary: "No event data is available right now. The desk will keep refreshing automatically."
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

function articleTone(category?: Article["category"]) {
  switch (category) {
    case "guide":
      return "guide";
    case "tournament":
      return "tournament";
    default:
      return "news";
  }
}

export function HomePage(props: {
  locale: Language;
  token: string | null;
  onUserLoaded: (user: UserProfile | null, source?: "fetch" | "mutation") => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>(undefined);
  const [query, setQuery] = useState("");
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const text = useMemo(() => labels[props.locale], [props.locale]);

  useEffect(() => {
    let active = true;
    const loadContent = async (options?: { silent?: boolean }) => {
      if (!options?.silent && !hasLoadedRef.current) {
        setLoading(true);
      }

      try {
        const [articleItems, patchItems, tournamentItems] = await Promise.all([
          fetchArticles({ language: props.locale }),
          fetchPatchNotes(props.locale),
          fetchTournaments(props.locale)
        ]);
        if (!active) {
          return;
        }
        setAllArticles(articleItems);
        setPatchNotes(patchItems);
        setTournaments(tournamentItems);
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
  }, [props.locale]);

  async function handleFavorite(contentType: "article" | "patch" | "tournament", contentId: string) {
    if (!props.token) {
      window.alert(text.needLogin);
      return;
    }
    await addFavorite(props.token, { contentType, contentId });
  }

  const articles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allArticles.filter((item) => {
      if (category && item.category !== category) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.summary.toLowerCase().includes(normalizedQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [allArticles, category, query]);
  const featuredArticle = articles[0] ?? null;
  const storyDeck = featuredArticle ? articles.slice(1, 7) : articles.slice(0, 6);
  const spotlightPatch = patchNotes[0] ?? null;
  const spotlightTournament = tournaments[0] ?? null;
  const guideSpotlight = allArticles.find((item) => item.category === "guide") ?? null;
  const latestUpdatedItem = [...articles, ...patchNotes, ...tournaments].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  )[0] ?? null;
  const coverageLabel = [
    `${text.news} ${articles.filter((item) => item.category === "news").length}`,
    `${text.guide} ${articles.filter((item) => item.category === "guide").length}`,
    `${text.tournament} ${tournaments.length}`
  ].join(" / ");
  const activeFilterLabel =
    category === "news"
      ? text.news
      : category === "guide"
        ? text.guide
        : category === "tournament"
          ? text.tournament
          : text.all;

  return (
    <section className="stack home-page">
      <section className="panel home-hero-shell">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-hero-topline">
              <p className="section-kicker">{text.kicker}</p>
              <div className="home-live-strip">
                <span className="home-pulse-dot" aria-hidden="true" />
                <span className="home-live-pill">{text.pulseTag}</span>
                <span className="home-live-pill">{text.autoRefresh}</span>
              </div>
            </div>
            <h2>{text.title}</h2>
            <p className="home-command-summary">{text.summary}</p>

            <div className="home-stat-grid">
              <article className="home-stat-card">
                <span>{text.articleCount}</span>
                <strong>{articles.length}</strong>
              </article>
              <article className="home-stat-card">
                <span>{text.patchCount}</span>
                <strong>{patchNotes.length}</strong>
              </article>
              <article className="home-stat-card">
                <span>{text.tournamentCount}</span>
                <strong>{tournaments.length}</strong>
              </article>
            </div>

            <div className="home-command-actions">
              <Link className="primary-btn" to="/intro">
                {text.exploreIntro}
              </Link>
              <Link className="ghost-btn" to="/chat">
                {text.askAgent}
              </Link>
            </div>
          </div>

          <div className="home-hero-stack">
            <article className={`home-focus-card tone-${articleTone(featuredArticle?.category)}`}>
              <div className="home-focus-head">
                <span>{text.prioritySignal}</span>
                {featuredArticle ? (
                  <p className="meta">
                    {getCategoryLabel(featuredArticle.category, props.locale)} / {featuredArticle.source} /{" "}
                    {formatContentDate(featuredArticle.publishedAt, props.locale)}
                  </p>
                ) : null}
              </div>

              {featuredArticle ? (
                <>
                  <h3>{featuredArticle.title}</h3>
                  <p>{featuredArticle.summary}</p>

                  <div className="tag-list">
                    {featuredArticle.tags.slice(0, 4).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="card-footer">
                    <a className="ghost-btn" href={featuredArticle.sourceUrl} rel="noreferrer" target="_blank">
                      {text.readSource}
                    </a>
                    <button onClick={() => handleFavorite("article", featuredArticle.id)} type="button">
                      {text.favorite}
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">{loading ? text.loading : text.emptyFeed}</p>
              )}
            </article>

            <div className="home-mini-grid">
              <article className="home-mini-card">
                <span>{text.latestPatch}</span>
                {spotlightPatch ? (
                  <>
                    <strong>{spotlightPatch.version}</strong>
                    <p>{spotlightPatch.title}</p>
                    <small>{spotlightPatch.summary}</small>
                  </>
                ) : (
                  <p className="muted">{text.emptyFeed}</p>
                )}
              </article>

              <article className="home-mini-card">
                <span>{spotlightTournament ? text.nextTournament : text.emptyEventsTitle}</span>
                {spotlightTournament ? (
                  <>
                    <strong>{spotlightTournament.title}</strong>
                    <p>{formatDateRange(spotlightTournament.startDate, spotlightTournament.endDate, props.locale)}</p>
                    <span className={`status-pill ${statusTone(spotlightTournament.status)}`}>
                      {getTournamentStatusLabel(spotlightTournament.status, props.locale)}
                    </span>
                  </>
                ) : (
                  <p className="muted">{text.emptyEventsSummary}</p>
                )}
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="panel home-control-panel">
        <div className="filters-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3>{text.filtersTitle}</h3>
          </div>
          <p className="muted">{text.filtersHint}</p>
        </div>

        <div className="home-control-grid">
          <div className="home-search-stack">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.search}
            />

            <div className="chip-row">
              <button className={!category ? "active" : ""} onClick={() => setCategory(undefined)} type="button">
                {text.all}
              </button>
              <button
                className={category === "news" ? "active" : ""}
                onClick={() => setCategory("news")}
                type="button"
              >
                {text.news}
              </button>
              <button
                className={category === "guide" ? "active" : ""}
                onClick={() => setCategory("guide")}
                type="button"
              >
                {text.guide}
              </button>
              <button
                className={category === "tournament" ? "active" : ""}
                onClick={() => setCategory("tournament")}
                type="button"
              >
                {text.tournament}
              </button>
            </div>
          </div>

          <div className="home-summary-strip">
            <article className="home-summary-card">
              <span>{text.visibleItems}</span>
              <strong>{articles.length}</strong>
              <p>{query ? `${text.keywordPrefix}: ${query}` : text.keywordIdle}</p>
            </article>

            <article className="home-summary-card">
              <span>{text.coverage}</span>
              <strong>{activeFilterLabel}</strong>
              <p>{coverageLabel}</p>
            </article>

            <article className="home-summary-card">
              <span>{text.latestUpdate}</span>
              <strong>
                {latestUpdatedItem ? formatContentDate(latestUpdatedItem.publishedAt, props.locale) : "--"}
              </strong>
              <p>{latestUpdatedItem ? latestUpdatedItem.source : text.emptyFeed}</p>
            </article>
          </div>
        </div>
      </section>

      <div className="home-board-layout">
        <section className="panel home-story-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Signal Grid</p>
              <h3>{text.storyGridTitle}</h3>
            </div>
            <p className="muted">{text.storyGridSubtitle}</p>
          </div>

          {storyDeck.length > 0 ? (
            <div className="home-story-list">
              {storyDeck.map((item, index) => (
                <article className="home-story-card" key={item.id}>
                  <div className="home-story-card-topline">
                    <span className="home-story-index">{String(index + 1).padStart(2, "0")}</span>
                    <p className="meta">
                      {getCategoryLabel(item.category, props.locale)} / {item.source} /{" "}
                      {formatContentDate(item.publishedAt, props.locale)}
                    </p>
                  </div>

                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>

                  <div className="tag-list">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="card-footer">
                    <a className="text-btn" href={item.sourceUrl} rel="noreferrer" target="_blank">
                      {text.readSource}
                    </a>
                    <button onClick={() => handleFavorite("article", item.id)} type="button">
                      {text.favorite}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !loading && (
              <article className="home-empty-card">
                <strong>{text.emptyFeed}</strong>
                <p>{text.filtersHint}</p>
              </article>
            )
          )}
        </section>

        <div className="home-side-rail">
          <section className="panel intel-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Patch</p>
                <h3>{text.patchNotes}</h3>
              </div>
            </div>

            {patchNotes.length > 0 ? (
              patchNotes.slice(0, 3).map((note) => (
                <article className="intel-line" key={note.id}>
                  <div>
                    <strong>{note.version}</strong>
                    <p>{note.title}</p>
                    <span className="muted">{note.summary}</span>
                  </div>
                  <div className="intel-line-actions">
                    <a href={note.sourceUrl} rel="noreferrer" target="_blank">
                      {text.readSource}
                    </a>
                    <button onClick={() => handleFavorite("patch", note.id)} type="button">
                      {text.favorite}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <article className="home-empty-card compact">
                <strong>{text.emptyFeed}</strong>
                <p>{text.filtersHint}</p>
              </article>
            )}
          </section>

          <section className="panel intel-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Events</p>
                <h3>{text.tournaments}</h3>
              </div>
            </div>

            {tournaments.length > 0 ? (
              tournaments.slice(0, 3).map((tour) => (
                <article className="intel-line" key={tour.id}>
                  <div>
                    <strong>{tour.title}</strong>
                    <p>{formatDateRange(tour.startDate, tour.endDate, props.locale)}</p>
                    <span className={`status-pill ${statusTone(tour.status)}`}>
                      {text.status}: {getTournamentStatusLabel(tour.status, props.locale)}
                    </span>
                  </div>
                  <div className="intel-line-actions">
                    <a href={tour.sourceUrl} rel="noreferrer" target="_blank">
                      {text.readSource}
                    </a>
                    <button onClick={() => handleFavorite("tournament", tour.id)} type="button">
                      {text.favorite}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <article className="home-empty-card compact">
                <strong>{text.emptyEventsTitle}</strong>
                <p>{text.emptyEventsSummary}</p>
              </article>
            )}
          </section>

          <section className="panel home-learning-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Route</p>
                <h3>{text.learningPath}</h3>
              </div>
            </div>

            <article className="home-learning-card">
              {guideSpotlight ? (
                <>
                  <span>{guideSpotlight.source}</span>
                  <strong>{guideSpotlight.title}</strong>
                  <p>{guideSpotlight.summary}</p>
                </>
              ) : (
                <>
                  <span>{text.learningPath}</span>
                  <strong>{text.exploreIntro}</strong>
                  <p>{text.learningSummary}</p>
                </>
              )}

              <div className="home-learning-actions">
                <Link className="primary-btn" to="/intro">
                  {text.exploreIntro}
                </Link>
                <Link className="ghost-btn" to="/heroes">
                  {text.openHeroes}
                </Link>
              </div>
            </article>
          </section>
        </div>
      </div>
    </section>
  );
}
