import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useMemo, useState } from "react";
import type { Language, UserProfile } from "@dotagame/contracts";
import { clearToken, getLocale, getToken, setLocale, setToken } from "./lib/storage";
import { ChatPage } from "./pages/ChatPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";

interface Copy {
  home: string;
  chat: string;
  profile: string;
  login: string;
  logout: string;
  subtitle: string;
}

const copyMap: Record<Language, Copy> = {
  "zh-CN": {
    home: "资讯",
    chat: "Agent Chat",
    profile: "个人中心",
    login: "登录",
    logout: "退出",
    subtitle: "赛事 · 版本 · 教学，一站式 Dota2 情报站"
  },
  "en-US": {
    home: "News",
    chat: "Agent Chat",
    profile: "Profile",
    login: "Login",
    logout: "Logout",
    subtitle: "Tournaments, patches, and guides in one Dota2 hub"
  }
};

export function App() {
  const [locale, setLocaleState] = useState<Language>(getLocale());
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const copy = useMemo(() => copyMap[locale], [locale]);

  function handleLocaleChange(nextLocale: Language) {
    setLocale(nextLocale);
    setLocaleState(nextLocale);
  }

  function handleAuth(nextToken: string, nextUser: UserProfile) {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    clearToken();
    setTokenState(null);
    setUser(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-kicker">DotaPulse</p>
          <h1>Dota2 News + Coaching</h1>
          <p className="subtitle">{copy.subtitle}</p>
        </div>
        <div className="topbar-controls">
          <div className="language-switch">
            <button
              className={locale === "zh-CN" ? "active" : ""}
              onClick={() => handleLocaleChange("zh-CN")}
            >
              中文
            </button>
            <button
              className={locale === "en-US" ? "active" : ""}
              onClick={() => handleLocaleChange("en-US")}
            >
              EN
            </button>
          </div>
          {token ? (
            <button className="ghost-btn" onClick={handleLogout}>
              {copy.logout}
            </button>
          ) : (
            <Link className="ghost-btn" to="/login">
              {copy.login}
            </Link>
          )}
        </div>
      </header>

      <nav className="nav">
        <Link to="/">{copy.home}</Link>
        <Link to="/chat">{copy.chat}</Link>
        <Link to="/profile">{copy.profile}</Link>
      </nav>

      <main>
        <Routes>
          <Route
            path="/"
            element={<HomePage locale={locale} token={token} onUserLoaded={setUser} />}
          />
          <Route path="/chat" element={<ChatPage locale={locale} token={token} />} />
          <Route
            path="/profile"
            element={<ProfilePage locale={locale} token={token} user={user} onUserLoaded={setUser} />}
          />
          <Route path="/login" element={<LoginPage locale={locale} onAuth={handleAuth} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
