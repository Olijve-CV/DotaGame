import { useEffect, useMemo, useState } from "react";
import type { HeroAvatarOption, Language, UserProfile } from "@dotagame/contracts";
import { HeroAvatarPicker } from "../components/HeroAvatarPicker";
import {
  fetchChatSessions,
  fetchFavorites,
  fetchHeroAvatars,
  fetchMe,
  updateMyAvatar
} from "../lib/api";

const labels = {
  "zh-CN": {
    title: "个人中心",
    needLogin: "请先登录后查看收藏、聊天记录和头像设置。",
    displayName: "用户名",
    email: "邮箱",
    avatarTitle: "英雄头像",
    avatarDescription: "你可以从全部英雄头像里重选，也可以再次随机分配。",
    avatarSave: "保存头像",
    avatarSaving: "正在保存...",
    avatarSaved: "头像已更新。",
    favorites: "收藏内容",
    chats: "聊天记录"
  },
  "en-US": {
    title: "Profile",
    needLogin: "Please login to view favorites, chat history, and avatar settings.",
    displayName: "Display Name",
    email: "Email",
    avatarTitle: "Hero Avatar",
    avatarDescription: "Choose from the full roster again, or let the system assign a fresh random pick.",
    avatarSave: "Save avatar",
    avatarSaving: "Saving...",
    avatarSaved: "Avatar updated.",
    favorites: "Favorites",
    chats: "Chat History"
  }
};

export function ProfilePage(props: {
  locale: Language;
  token: string | null;
  user: UserProfile | null;
  onUserLoaded: (user: UserProfile | null) => void;
}) {
  const [favorites, setFavorites] = useState<Array<{ contentType: string; contentId: string }>>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; question: string; answer: string }>>([]);
  const [avatarOptions, setAvatarOptions] = useState<HeroAvatarOption[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const text = useMemo(() => labels[props.locale], [props.locale]);
  const displayName = props.user?.name?.trim() || props.user?.email || "-";
  const currentAvatar = props.user?.avatar ?? null;

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
      return;
    }

    let active = true;

    Promise.all([fetchMe(props.token), fetchFavorites(props.token), fetchChatSessions(props.token)])
      .then(([user, favs, chats]) => {
        if (!active) {
          return;
        }
        props.onUserLoaded(user);
        setFavorites(favs);
        setSessions(chats);
      })
      .catch(() => {
        if (active) {
          props.onUserLoaded(null);
        }
      });

    return () => {
      active = false;
    };
  }, [props.token, props.onUserLoaded]);

  if (!props.token) {
    return (
      <section className="stack">
        <div className="panel">{text.needLogin}</div>
      </section>
    );
  }

  async function handleAvatarSave() {
    if (!props.token) {
      return;
    }

    setAvatarFeedback(null);
    setIsSavingAvatar(true);
    try {
      const user = await updateMyAvatar(props.token, selectedAvatarId);
      props.onUserLoaded(user);
      setAvatarFeedback(text.avatarSaved);
    } catch {
      setAvatarFeedback(null);
    } finally {
      setIsSavingAvatar(false);
    }
  }

  return (
    <section className="stack">
      <div className="panel profile-hero">
        <div className="profile-hero-main">
          <div className="profile-avatar-frame">
            {currentAvatar && <img alt={currentAvatar.name} src={currentAvatar.image} />}
          </div>
          <div className="stack profile-summary">
            <h2>{text.title}</h2>
            <p className="muted">
              <strong>{text.displayName}:</strong> {displayName}
            </p>
            <p className="muted">
              <strong>{text.email}:</strong> {props.user?.email ?? "-"}
            </p>
          </div>
        </div>

        <section className="profile-avatar-editor">
          <div className="profile-avatar-editor-head">
            <div>
              <h3>{text.avatarTitle}</h3>
              <p className="muted">{text.avatarDescription}</p>
            </div>
            <button
              className="primary-btn"
              disabled={isSavingAvatar}
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
            onSelect={setSelectedAvatarId}
          />
        </section>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>{text.favorites}</h3>
          {favorites.length === 0 ? (
            <p className="muted">-</p>
          ) : (
            favorites.map((item) => (
              <div key={`${item.contentType}-${item.contentId}`} className="line-item">
                <span>{item.contentType}</span>
                <code>{item.contentId}</code>
              </div>
            ))
          )}
        </div>
        <div className="panel">
          <h3>{text.chats}</h3>
          {sessions.length === 0 ? (
            <p className="muted">-</p>
          ) : (
            sessions.map((item) => (
              <div key={item.id} className="chat-log">
                <p>
                  <strong>Q:</strong> {item.question}
                </p>
                <p>
                  <strong>A:</strong> {item.answer}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
