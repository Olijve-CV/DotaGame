import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { Language, UserProfile } from "@dotagame/contracts";
import { fetchMe } from "./lib/api";
import {
  clearStoredUser,
  clearToken,
  getLocale,
  getStoredUser,
  getToken,
  setLocale,
  setStoredUser,
  setToken
} from "./lib/storage";
import { ChatPage } from "./pages/ChatPage";
import { DotaIntroPage } from "./pages/DotaIntroPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";

interface Copy {
  home: string;
  intro: string;
  chat: string;
  profile: string;
  account: string;
  login: string;
  logout: string;
  subtitle: string;
}

const copyMap: Record<Language, Copy> = {
  "zh-CN": {
    home: "资讯",
    intro: "Dota2 介绍",
    chat: "智能咨询",
    profile: "个人中心",
    account: "用户",
    login: "登录",
    logout: "退出登录",
    subtitle: "赛事、补丁、攻略与 Dota2 详细介绍分区展示"
  },
  "en-US": {
    home: "News",
    intro: "Dota2 Intro",
    chat: "Agent Chat",
    profile: "Profile",
    account: "User",
    login: "Login",
    logout: "Logout",
    subtitle: "News, coaching, and a standalone Dota2 introduction section"
  }
};

export function App() {
  const initialToken = getToken();
  const [locale, setLocaleState] = useState<Language>(getLocale());
  const [token, setTokenState] = useState<string | null>(initialToken);
  const [user, setUser] = useState<UserProfile | null>(() =>
    initialToken ? getStoredUser() : null
  );
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const copy = useMemo(() => copyMap[locale], [locale]);
  const accountName = user?.name?.trim() || user?.email || copy.profile;
  const accountInitial = accountName.charAt(0).toUpperCase();

  useEffect(() => {
    if (user) {
      setStoredUser(user);
      return;
    }

    clearStoredUser();
  }, [user]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let active = true;
    fetchMe(token)
      .then((nextUser) => {
        if (active) {
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  function handleLocaleChange(nextLocale: Language) {
    setLocale(nextLocale);
    setLocaleState(nextLocale);
  }

  function handleAuth(nextToken: string, nextUser: UserProfile) {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
    setIsAccountMenuOpen(false);
  }

  function handleLogout() {
    clearToken();
    setTokenState(null);
    setUser(null);
    setIsAccountMenuOpen(false);
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
            <div className="account-menu" ref={accountMenuRef}>
              <button
                aria-expanded={isAccountMenuOpen}
                className="account-trigger"
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                type="button"
              >
                {user?.avatar ? (
                  <img
                    alt={user.avatar.name}
                    className="account-avatar account-avatar-image"
                    src={user.avatar.image}
                  />
                ) : (
                  <span className="account-avatar">{accountInitial}</span>
                )}
                <span className="account-meta">
                  <strong>{accountName}</strong>
                  <span className="account-label">{copy.account}</span>
                </span>
                <span className={`account-caret${isAccountMenuOpen ? " open" : ""}`}>v</span>
              </button>

              {isAccountMenuOpen && (
                <div className="account-dropdown">
                  {user?.avatar && (
                    <div className="account-dropdown-hero">
                      <img alt={user.avatar.name} src={user.avatar.image} />
                      <strong>{user.avatar.name}</strong>
                    </div>
                  )}
                  <p className="account-email">{user?.email ?? accountName}</p>
                  <Link
                    className="account-dropdown-link"
                    onClick={() => setIsAccountMenuOpen(false)}
                    to="/profile"
                  >
                    {copy.profile}
                  </Link>
                  <button className="account-dropdown-link" onClick={handleLogout} type="button">
                    {copy.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link className="ghost-btn" to="/login">
              {copy.login}
            </Link>
          )}
        </div>
      </header>

      <nav className="nav">
        <Link to="/">{copy.home}</Link>
        <Link to="/intro">{copy.intro}</Link>
        <Link to="/chat">{copy.chat}</Link>
      </nav>

      <main>
        <Routes>
          <Route
            path="/"
            element={<HomePage locale={locale} token={token} onUserLoaded={setUser} />}
          />
          <Route path="/intro" element={<DotaIntroPage locale={locale} />} />
          <Route path="/chat" element={<ChatPage locale={locale} token={token} />} />
          <Route
            path="/profile"
            element={<ProfilePage locale={locale} token={token} user={user} onUserLoaded={setUser} />}
          />
          <Route
            path="/login"
            element={<LoginPage locale={locale} onAuth={handleAuth} token={token} />}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
