import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
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
  login: string;
  logout: string;
  title: string;
  subtitle: string;
}

const copyMap: Record<Language, Copy> = {
  "zh-CN": {
    home: "情报台",
    intro: "新手入门",
    chat: "智能问答",
    profile: "个人资料",
    login: "登录",
    logout: "退出登录",
    title: "Dota 2 情报台",
    subtitle: "版本、入门和对局问答放进一个更紧凑的前台。"
  },
  "en-US": {
    home: "Intel Desk",
    intro: "Starter Guide",
    chat: "Agent Chat",
    profile: "Profile",
    login: "Login",
    logout: "Logout",
    title: "Dota 2 Intel Desk",
    subtitle: "Patch, onboarding, and match Q&A in one tighter front desk."
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
  const userStateVersionRef = useRef(0);
  const copy = useMemo(() => copyMap[locale], [locale]);
  const accountName = user?.name?.trim() || user?.email || copy.profile;
  const accountEmail = user?.email && user.email !== accountName ? user.email : null;
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
    const requestVersion = userStateVersionRef.current;
    fetchMe(token)
      .then((nextUser) => {
        if (active && requestVersion === userStateVersionRef.current) {
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (active && requestVersion === userStateVersionRef.current) {
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

  function handleUserLoaded(nextUser: UserProfile | null, source: "fetch" | "mutation" = "fetch") {
    if (source === "mutation") {
      userStateVersionRef.current += 1;
    }

    setUser(nextUser);
  }

  function handleAuth(nextToken: string, nextUser: UserProfile) {
    userStateVersionRef.current += 1;
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
    setIsAccountMenuOpen(false);
  }

  function handleLogout() {
    userStateVersionRef.current += 1;
    clearToken();
    setTokenState(null);
    setUser(null);
    setIsAccountMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar app-header-shell">
        <div className="app-brand-shell">
          <p className="brand-kicker">DotaPulse</p>
          <div>
            <h1>{copy.title}</h1>
            <p className="subtitle">{copy.subtitle}</p>
          </div>
        </div>

        <div className="topbar-controls app-header-controls">
          <label className="language-switch" htmlFor="app-language-select">
            <select
              aria-label="Language"
              id="app-language-select"
              onChange={(event) => handleLocaleChange(event.target.value as Language)}
              value={locale}
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </label>

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
                  <div className="account-dropdown-summary">
                    <strong className="account-dropdown-name">{accountName}</strong>
                    {accountEmail ? <p className="account-email">{accountEmail}</p> : null}
                  </div>
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

      <nav className="nav app-nav">
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/">
          {copy.home}
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/intro">
          {copy.intro}
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/chat">
          {copy.chat}
        </NavLink>
      </nav>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={<HomePage locale={locale} token={token} onUserLoaded={handleUserLoaded} />}
          />
          <Route path="/intro" element={<DotaIntroPage locale={locale} />} />
          <Route path="/chat" element={<ChatPage locale={locale} token={token} />} />
          <Route
            path="/profile"
            element={<ProfilePage locale={locale} token={token} user={user} onUserLoaded={handleUserLoaded} />}
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
