import type { Language, UserProfile } from "@dotagame/contracts";

const TOKEN_KEY = "dotagame_token";
const LOCALE_KEY = "dotagame_locale";
const USER_KEY = "dotagame_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isUserProfile(parsed)) {
      clearStoredUser();
      return null;
    }
    return parsed;
  } catch {
    clearStoredUser();
    return null;
  }
}

export function setStoredUser(user: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function getLocale(): Language {
  const raw = localStorage.getItem(LOCALE_KEY);
  return raw === "zh-CN" || raw === "en-US" ? raw : "zh-CN";
}

export function setLocale(locale: Language): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Partial<UserProfile>;
  const avatar = user.avatar as UserProfile["avatar"] | undefined;

  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.name === "string" &&
    typeof user.createdAt === "string" &&
    Boolean(avatar) &&
    typeof avatar?.id === "number" &&
    typeof avatar?.name === "string" &&
    typeof avatar?.image === "string"
  );
}
