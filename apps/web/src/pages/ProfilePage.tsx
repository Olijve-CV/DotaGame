import { useEffect, useMemo, useState } from "react";
import type { Language, UserProfile } from "@dotagame/contracts";
import { fetchChatSessions, fetchFavorites, fetchMe } from "../lib/api";

const labels = {
  "zh-CN": {
    title: "个人中心",
    needLogin: "请先登录后查看收藏和聊天记录。",
    displayName: "用户名",
    email: "邮箱",
    favorites: "收藏内容",
    chats: "聊天记录"
  },
  "en-US": {
    title: "Profile",
    needLogin: "Please login to view favorites and chat history.",
    displayName: "Display Name",
    email: "Email",
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
  const text = useMemo(() => labels[props.locale], [props.locale]);
  const displayName = props.user?.name?.trim() || props.user?.email || "-";

  useEffect(() => {
    if (!props.token) {
      props.onUserLoaded(null);
      setFavorites([]);
      setSessions([]);
      return;
    }

    Promise.all([fetchMe(props.token), fetchFavorites(props.token), fetchChatSessions(props.token)])
      .then(([user, favs, chats]) => {
        props.onUserLoaded(user);
        setFavorites(favs);
        setSessions(chats);
      })
      .catch(() => {
        props.onUserLoaded(null);
      });
  }, [props.token, props.onUserLoaded]);

  if (!props.token) {
    return (
      <section className="stack">
        <div className="panel">{text.needLogin}</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="panel">
        <h2>{text.title}</h2>
        {props.user && (
          <div className="stack profile-summary">
            <p className="muted">
              <strong>{text.displayName}:</strong> {displayName}
            </p>
            <p className="muted">
              <strong>{text.email}:</strong> {props.user.email}
            </p>
          </div>
        )}
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
