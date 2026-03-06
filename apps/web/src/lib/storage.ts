import type { Language } from "@dotagame/contracts";

const TOKEN_KEY = "dotagame_token";
const LOCALE_KEY = "dotagame_locale";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getLocale(): Language {
  const raw = localStorage.getItem(LOCALE_KEY);
  return raw === "zh-CN" || raw === "en-US" ? raw : "zh-CN";
}

export function setLocale(locale: Language): void {
  localStorage.setItem(LOCALE_KEY, locale);
}
