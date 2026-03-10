import { useEffect, useMemo, useState } from "react";
import type { Article, HeroAvatarOption, Language, PatchNote, Tournament, UserProfile } from "@dotagame/contracts";
import { HeroAvatarPicker } from "../components/HeroAvatarPicker";
import {
  fetchArticles,
  fetchChatSessions,
  fetchFavorites,
  fetchHeroAvatars,
  fetchPatchNotes,
  fetchTournaments,
  removeFavorite,
  updateMyAvatar
} from "../lib/api";
import {
  formatContentDateTime,
  getCategoryLabel
} from "../lib/contentFormatting";

type FavoriteDisplay = {
  key: string;
  contentType: "article" | "patch" | "tournament";
  contentId: string;
  title: string;
  summary: string;
  source: string;
  href: string;
};

type ChatSessionDisplay = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

const labels = {
  "zh-CN": {
    title: "玩家档案",
    needLogin: "请先登录后再查看收藏、聊天记录和头像设置。",
    summary: "把你的头像、收藏和最近问答整理在同一个个人面板里。",
    displayName: "用户名",
    email: "邮箱",
    avatarTitle: "英雄头像",
    avatarDescription: "你可以重新选择英雄头像，也可以切回随机分配。",
    avatarRandomPreview: "随机头像",
    avatarSave: "保存头像",
    avatarSaving: "保存中...",
    avatarSaved: "头像已更新。",
    avatarSaveError: "头像保存失败，请稍后再试。",
    favorites: "我的收藏",
    chats: "最近问答",
    identity: "个人信息",
    favoritesCount: "收藏条目",
    chatCount: "聊天会话",
    emptyFavorites: "你还没有收藏任何内容。",
    emptyChats: "你还没有聊天记录。",
    questionLabel: "问题",
    answerLabel: "回答",
    openSource: "打开来源",
    removeFavorite: "移除",
    removingFavorite: "移除中...",
    favoriteRemoved: "收藏已移除。",
    favoriteRemoveError: "暂时无法移除收藏，请稍后再试。",
    untitled: "未命名内容",
    unknownSource: "未知来源",
    unknownSummary: "这条内容暂时没有摘要。",
    askedAt: "提问时间"
  },
  "en-US": {
    title: "Player Dossier",
    needLogin: "Please login to view favorites, chat history, and avatar settings.",
    summary: "Manage your avatar, saved items, and recent Q&A from one clear profile surface.",
    displayName: "Display Name",
    email: "Email",
    avatarTitle: "Hero Avatar",
    avatarDescription: "Pick a different hero avatar again, or move back to a random assignment.",
    avatarRandomPreview: "Random pick",
    avatarSave: "Save avatar",
    avatarSaving: "Saving...",
    avatarSaved: "Avatar updated.",
    avatarSaveError: "Unable to save your avatar right now. Please try again.",
    favorites: "Favorites",
    chats: "Recent Sessions",
    identity: "Identity",
    favoritesCount: "Saved Items",
    chatCount: "Chat Sessions",
    emptyFavorites: "No favorites saved yet.",
    emptyChats: "No chat sessions yet.",
    questionLabel: "Question",
    answerLabel: "Answer",
    openSource: "Open Source",
    removeFavorite: "Remove",
    removingFavorite: "Removing...",
    favoriteRemoved: "Favorite removed.",
    favoriteRemoveError: "Unable to remove this favorite right now.",
    untitled: "Untitled item",
    unknownSource: "Unknown source",
    unknownSummary: "No summary is available for this item.",
    askedAt: "Asked At"
  }
};

export function ProfilePage(props: {
  locale: Language;
  token: string | null;
  user: UserProfile | null;
  onUserLoaded: (user: UserProfile | null, source?: "fetch" | "mutation") => void;
}) {
  const [favorites, setFavorites] = useState<Array<{ contentType: string; contentId: string }>>([]);
  const [sessions, setSessions] = useState<ChatSessionDisplay[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<HeroAvatarOption[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isRemovingFavoriteKey, setIsRemovingFavoriteKey] = useState<string | null>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);
  const text = useMemo(() => labels[props.locale], [props.locale]);
  const customName = props.user?.name?.trim() || "";
  const displayName = customName || props.user?.email?.split("@")[0] || props.user?.email || "-";
  const currentAvatar = props.user?.avatar ?? null;
  const previewAvatar = useMemo(() => {
    if (selectedAvatarId == null) {
      return null;
    }

    return (
      avatarOptions.find((item) => item.id === selectedAvatarId) ??
      (currentAvatar?.id === selectedAvatarId ? currentAvatar : null)
    );
  }, [avatarOptions, currentAvatar, selectedAvatarId]);
  const hasAvatarChange = selectedAvatarId !== (currentAvatar?.id ?? null);

  const favoriteItems = useMemo(() => {
    const articleMap = new Map(articles.map((item) => [item.id, item]));
    const patchMap = new Map(patchNotes.map((item) => [item.id, item]));
    const tournamentMap = new Map(tournaments.map((item) => [item.id, item]));

    return favorites.map<FavoriteDisplay>((item) => {
      const key = `${item.contentType}-${item.contentId}`;
      const record =
        item.contentType === "article"
          ? articleMap.get(item.contentId)
          : item.contentType === "patch"
            ? patchMap.get(item.contentId)
            : tournamentMap.get(item.contentId);

      return {
        key,
        contentType: item.contentType as FavoriteDisplay["contentType"],
        contentId: item.contentId,
        title: record?.title ?? text.untitled,
        summary: record?.summary ?? text.unknownSummary,
        source: record?.source ?? text.unknownSource,
        href: record?.sourceUrl ?? "#"
      };
    });
  }, [articles, favorites, patchNotes, text.unknownSource, text.unknownSummary, text.untitled, tournaments]);

  useEffect(() => {
    setSelectedAvatarId(props.user?.avatar.id ?? null);
  }, [props.user?.avatar.id]);

  useEffect(() => {
    let active = true;

    fetchHeroAvatars()
      .then((items) => {
        if (active) {
          setAvatarOptions(items);
        }
      })
      .catch(() => {
        if (active) {
          setAvatarOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!props.token) {
      props.onUserLoaded(null);
      setFavorites([]);
      setSessions([]);
      setArticles([]);
      setPatchNotes([]);
      setTournaments([]);
      return;
    }

    let active = true;

    Promise.all([
      fetchFavorites(props.token),
      fetchChatSessions(props.token),
      fetchArticles({ language: props.locale }),
      fetchPatchNotes(props.locale),
      fetchTournaments(props.locale)
    ])
      .then(([favs, chats, articleItems, patchItems, tournamentItems]) => {
        if (!active) {
          return;
        }

        setFavorites(favs);
        setSessions(chats);
        setArticles(articleItems);
        setPatchNotes(patchItems);
        setTournaments(tournamentItems);
      })
      .catch(() => {
        if (active) {
          setFavorites([]);
          setSessions([]);
          setArticles([]);
          setPatchNotes([]);
          setTournaments([]);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale, props.onUserLoaded, props.token]);

  if (!props.token) {
    return (
      <section className="stack">
        <div className="panel">{text.needLogin}</div>
      </section>
    );
  }

  async function handleAvatarSave() {
    if (!props.token || !hasAvatarChange) {
      return;
    }

    setAvatarFeedback(null);
    setIsSavingAvatar(true);
    try {
      const user = await updateMyAvatar(props.token, selectedAvatarId);
      props.onUserLoaded(user, "mutation");
      setAvatarFeedback(text.avatarSaved);
    } catch {
      setAvatarFeedback(text.avatarSaveError);
    } finally {
      setIsSavingAvatar(false);
    }
  }

  async function handleRemoveFavorite(item: FavoriteDisplay) {
    if (!props.token) {
      return;
    }

    setFavoriteFeedback(null);
    setIsRemovingFavoriteKey(item.key);
    try {
      const nextFavorites = await removeFavorite(props.token, {
        contentType: item.contentType,
        contentId: item.contentId
      });
      setFavorites(nextFavorites);
      setFavoriteFeedback(text.favoriteRemoved);
    } catch {
      setFavoriteFeedback(text.favoriteRemoveError);
    } finally {
      setIsRemovingFavoriteKey(null);
    }
  }

  return (
    <section className="stack profile-page">
      <section className="panel profile-command">
        <div className="profile-command-main">
          <div className="profile-avatar-frame">
            {previewAvatar ? (
              <img alt={previewAvatar.name} src={previewAvatar.image} />
            ) : (
              <span className="avatar-random-badge large">?</span>
            )}
          </div>

          <div className="profile-summary">
            <p className="section-kicker">{text.identity}</p>
            <h2 className="profile-heading">{displayName}</h2>
            <p className="profile-heading-note">{text.title}</p>
            <p className="dota-intro-summary">{text.summary}</p>
            <div className="profile-detail-grid">
              <article className="profile-detail-card">
                <span>{text.displayName}</span>
                <strong>{displayName}</strong>
              </article>
              <article className="profile-detail-card">
                <span>{text.email}</span>
                <strong>{props.user?.email ?? "-"}</strong>
              </article>
              <article className="profile-detail-card">
                <span>{text.avatarTitle}</span>
                <strong>{previewAvatar?.name ?? text.avatarRandomPreview}</strong>
              </article>
            </div>
          </div>
        </div>

        <div className="profile-metric-grid">
          <article className="profile-metric-card">
            <span>{text.favoritesCount}</span>
            <strong>{favoriteItems.length}</strong>
          </article>
          <article className="profile-metric-card">
            <span>{text.chatCount}</span>
            <strong>{sessions.length}</strong>
          </article>
        </div>
      </section>

      <section className="panel profile-avatar-panel">
        <div className="profile-avatar-editor-head">
          <div>
            <p className="section-kicker">Avatar</p>
            <h3>{text.avatarTitle}</h3>
            <p className="muted">{text.avatarDescription}</p>
          </div>
          <button
            className="primary-btn"
            disabled={isSavingAvatar || !hasAvatarChange}
            onClick={handleAvatarSave}
            type="button"
          >
            {isSavingAvatar ? text.avatarSaving : text.avatarSave}
          </button>
        </div>

        {avatarFeedback && <p className="muted">{avatarFeedback}</p>}

        <HeroAvatarPicker
          disabled={isSavingAvatar}
          locale={props.locale}
          options={avatarOptions}
          selectedAvatarId={selectedAvatarId}
          onSelect={(avatarHeroId) => {
            setAvatarFeedback(null);
            setSelectedAvatarId(avatarHeroId);
          }}
        />
      </section>

      <div className="two-col profile-lower-grid">
        <section className="panel profile-log-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Saved</p>
              <h3>{text.favorites}</h3>
            </div>
          </div>

          {favoriteFeedback && <p className="muted">{favoriteFeedback}</p>}

          {favoriteItems.length === 0 ? (
            <p className="muted">{text.emptyFavorites}</p>
          ) : (
            <div className="profile-record-list">
              {favoriteItems.map((item) => (
                <article key={item.key} className="profile-record-card rich">
                  <span>{getCategoryLabel(item.contentType, props.locale)}</span>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                  <div className="profile-record-footer">
                    <small>{item.source}</small>
                    <div className="profile-record-actions">
                      {item.href !== "#" && (
                        <a href={item.href} rel="noreferrer" target="_blank">
                          {text.openSource}
                        </a>
                      )}
                      <button
                        disabled={isRemovingFavoriteKey === item.key}
                        onClick={() => void handleRemoveFavorite(item)}
                        type="button"
                      >
                        {isRemovingFavoriteKey === item.key ? text.removingFavorite : text.removeFavorite}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel profile-log-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">History</p>
              <h3>{text.chats}</h3>
            </div>
          </div>

          {sessions.length === 0 ? (
            <p className="muted">{text.emptyChats}</p>
          ) : (
            <div className="profile-session-list">
              {sessions.map((item) => (
                <article key={item.id} className="profile-session-card">
                  <span className="profile-session-time">
                    {text.askedAt}: {formatContentDateTime(item.createdAt, props.locale)}
                  </span>
                  <p>
                    <strong>{text.questionLabel}:</strong> {item.question}
                  </p>
                  <p>
                    <strong>{text.answerLabel}:</strong> {item.answer}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
