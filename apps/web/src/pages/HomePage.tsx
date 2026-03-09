import { useEffect, useMemo, useState } from "react";
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

const labels = {
  "zh-CN": {
    kicker: "Intel Desk",
    title: "先知道现在发生了什么，再决定要学什么",
    summary:
      "这里把补丁、攻略、赛事和入门导览放进同一张前台面板。你可以先扫全局，再切进具体英雄、位置和版本问题。",
    search: "搜索标题或标签",
    filtersTitle: "筛选当前情报流",
    filtersHint: "按类别或关键词收窄内容，适合快速补丁回顾与赛事浏览。",
    all: "全部",
    news: "新闻",
    guide: "攻略",
    tournament: "赛事",
    patchNotes: "版本观察",
    tournaments: "赛事日程",
    favorite: "收藏",
    needLogin: "登录后才能收藏内容。",
    loading: "正在整理最新内容...",
    emptyFeed: "当前没有可展示的内容。",
    exploreIntro: "查看游戏介绍",
    askAgent: "打开战术问答",
    latestPatch: "最新版本观察",
    nextTournament: "赛事焦点",
    activeFilter: "当前筛选",
    keywordIdle: "未输入关键词，适合先浏览全局。",
    keywordPrefix: "关键词",
    readSource: "查看来源",
    feedTitle: "内容前台",
    feedSubtitle: "先看一篇重点内容，再向下拆成补丁、赛事与学习入口。",
    sourceLabel: "来源",
    articleCount: "情报条目",
    patchCount: "版本条目",
    tournamentCount: "赛事条目",
    status: "状态"
  },
  "en-US": {
    kicker: "Intel Desk",
    title: "See the state of Dota first, then decide what to study",
    summary:
      "Patch notes, guides, tournaments, and onboarding now sit on one front desk. Scan the field quickly, then drop into the specific hero, role, or patch question you care about.",
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
    exploreIntro: "Open Game Intro",
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
    status: "Status"
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

export function HomePage(props: {
  locale: Language;
  token: string | null;
  onUserLoaded: (user: UserProfile | null, source?: "fetch" | "mutation") => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>(undefined);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const text = useMemo(() => labels[props.locale], [props.locale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchArticles({ language: props.locale, category, query }),
      fetchPatchNotes(props.locale),
      fetchTournaments(props.locale)
    ])
      .then(([articleItems, patchItems, tournamentItems]) => {
        if (!active) {
          return;
        }
        setArticles(articleItems);
        setPatchNotes(patchItems);
        setTournaments(tournamentItems);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale, category, query]);

  async function handleFavorite(contentType: "article" | "patch" | "tournament", contentId: string) {
    if (!props.token) {
      window.alert(text.needLogin);
      return;
    }
    await addFavorite(props.token, { contentType, contentId });
  }

  const featuredArticle = articles[0] ?? null;
  const secondaryArticles = articles.slice(1, 5);
  const spotlightPatch = patchNotes[0] ?? null;
  const spotlightTournament = tournaments[0] ?? null;
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
      <section className="panel home-command">
        <div className="home-command-copy">
          <p className="section-kicker">{text.kicker}</p>
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

        <div className="home-command-rail">
          <article className="home-brief-card">
            <span>{text.latestPatch}</span>
            {spotlightPatch ? (
              <>
                <strong>{spotlightPatch.version}</strong>
                <p>{spotlightPatch.summary}</p>
                <a href={spotlightPatch.sourceUrl} rel="noreferrer" target="_blank">
                  {text.readSource}
                </a>
              </>
            ) : (
              <p className="muted">{text.emptyFeed}</p>
            )}
          </article>

          <article className="home-brief-card">
            <span>{text.nextTournament}</span>
            {spotlightTournament ? (
              <>
                <strong>{spotlightTournament.title}</strong>
                <p>{formatDateRange(spotlightTournament.startDate, spotlightTournament.endDate, props.locale)}</p>
                <span className={`status-pill ${statusTone(spotlightTournament.status)}`}>
                  {getTournamentStatusLabel(spotlightTournament.status, props.locale)}
                </span>
              </>
            ) : (
              <p className="muted">{text.emptyFeed}</p>
            )}
          </article>

          <article className="home-brief-card">
            <span>{text.activeFilter}</span>
            <strong>{activeFilterLabel}</strong>
            <p>{query ? `${text.keywordPrefix}: ${query}` : text.keywordIdle}</p>
          </article>
        </div>
      </section>

      <section className="panel filters-panel">
        <div className="filters-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3>{text.filtersTitle}</h3>
          </div>
          <p className="muted">{text.filtersHint}</p>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
        />

        <div className="chip-row">
          <button className={!category ? "active" : ""} onClick={() => setCategory(undefined)} type="button">
            {text.all}
          </button>
          <button className={category === "news" ? "active" : ""} onClick={() => setCategory("news")} type="button">
            {text.news}
          </button>
          <button className={category === "guide" ? "active" : ""} onClick={() => setCategory("guide")} type="button">
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
      </section>

      {loading && <p className="muted">{text.loading}</p>}

      <div className="home-feed-layout">
        <section className="panel home-feed-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Signal</p>
              <h3>{text.feedTitle}</h3>
            </div>
            <p className="muted">{text.feedSubtitle}</p>
          </div>

          {featuredArticle ? (
            <article className="featured-story">
              <p className="meta">
                {getCategoryLabel(featuredArticle.category, props.locale)} / {featuredArticle.source} /{" "}
                {formatContentDate(featuredArticle.publishedAt, props.locale)}
              </p>
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
            </article>
          ) : (
            !loading && <p className="muted">{text.emptyFeed}</p>
          )}

          {secondaryArticles.length > 0 && (
            <div className="home-story-grid">
              {secondaryArticles.map((item) => (
                <article className="story-card" key={item.id}>
                  <p className="meta">
                    {item.source} / {formatContentDate(item.publishedAt, props.locale)}
                  </p>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
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

            {patchNotes.slice(0, 3).map((note) => (
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
            ))}
          </section>

          <section className="panel intel-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Events</p>
                <h3>{text.tournaments}</h3>
              </div>
            </div>

            {tournaments.slice(0, 3).map((tour) => (
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
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}
