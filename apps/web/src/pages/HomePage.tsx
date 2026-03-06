import { useEffect, useMemo, useState } from "react";
import type { Article, Language, PatchNote, Tournament } from "@dotagame/contracts";
import { addFavorite, fetchArticles, fetchMe, fetchPatchNotes, fetchTournaments } from "../lib/api";

const labels = {
  "zh-CN": {
    search: "搜索标题/标签",
    all: "全部",
    news: "资讯",
    guide: "教学",
    tournament: "赛事",
    patchNotes: "版本更新",
    tournaments: "赛事日程",
    favorite: "收藏",
    needLogin: "请先登录后再收藏。"
  },
  "en-US": {
    search: "Search title/tags",
    all: "All",
    news: "News",
    guide: "Guides",
    tournament: "Tournaments",
    patchNotes: "Patch Notes",
    tournaments: "Event Schedule",
    favorite: "Favorite",
    needLogin: "Please login before saving favorites."
  }
};

export function HomePage(props: {
  locale: Language;
  token: string | null;
  onUserLoaded: (user: { id: string; email: string; name: string; createdAt: string } | null) => void;
}) {
  const [category, setCategory] = useState<"news" | "guide" | "tournament" | undefined>(undefined);
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

  useEffect(() => {
    if (!props.token) {
      props.onUserLoaded(null);
      return;
    }
    fetchMe(props.token).then(props.onUserLoaded).catch(() => props.onUserLoaded(null));
  }, [props.token]);

  async function handleFavorite(contentType: "article" | "patch" | "tournament", contentId: string) {
    if (!props.token) {
      window.alert(text.needLogin);
      return;
    }
    await addFavorite(props.token, { contentType, contentId });
  }

  return (
    <section className="stack">
      <div className="panel filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
        />
        <div className="chip-row">
          <button className={!category ? "active" : ""} onClick={() => setCategory(undefined)}>
            {text.all}
          </button>
          <button className={category === "news" ? "active" : ""} onClick={() => setCategory("news")}>
            {text.news}
          </button>
          <button className={category === "guide" ? "active" : ""} onClick={() => setCategory("guide")}>
            {text.guide}
          </button>
          <button
            className={category === "tournament" ? "active" : ""}
            onClick={() => setCategory("tournament")}
          >
            {text.tournament}
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading...</p>}

      <div className="grid">
        {articles.map((item) => (
          <article className="card" key={item.id}>
            <p className="meta">
              {item.source} · {new Date(item.publishedAt).toLocaleDateString()}
            </p>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <div className="card-footer">
              <span>{item.tags.join(" · ")}</span>
              <button onClick={() => handleFavorite("article", item.id)}>{text.favorite}</button>
            </div>
          </article>
        ))}
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>{text.patchNotes}</h2>
          {patchNotes.map((note) => (
            <div className="line-item" key={note.id}>
              <div>
                <strong>{note.version}</strong> · {note.title}
                <p className="muted">{note.summary}</p>
              </div>
              <button onClick={() => handleFavorite("patch", note.id)}>{text.favorite}</button>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>{text.tournaments}</h2>
          {tournaments.map((tour) => (
            <div className="line-item" key={tour.id}>
              <div>
                <strong>{tour.title}</strong>
                <p className="muted">
                  {tour.startDate} ~ {tour.endDate} · {tour.status}
                </p>
              </div>
              <button onClick={() => handleFavorite("tournament", tour.id)}>{text.favorite}</button>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
