"use client";

/**
 * Client-side API layer for the app screens.
 *
 * Security model (mirrors docs/Security.md):
 * - The refresh token lives ONLY in the HttpOnly cookie (Path=/api/auth) — JS
 *   never sees it.
 * - The access token is kept in MODULE MEMORY only (never localStorage), so an
 *   XSS can't lift it. On a 401 we silently refresh (cookie rotates) and retry
 *   once; on page load call `bootstrapSession()` to mint a fresh access token
 *   from the cookie.
 */

export interface SessionUser {
  id: string;
  role: "STUDENT" | "FACULTY" | "ALUMNI" | "ADMIN";
  status: string;
  name: string;
}

export interface Profile {
  userId: string;
  name: string;
  role: string;
  branch: string | null;
  year: number | null;
  bio: string | null;
  cgpa: number | null;
  cgpaPublic: boolean;
  skills: { id: string; name: string; domain: string; proficiency: string }[];
}

export interface TaxonomySkill {
  id: string;
  name: string;
  domain: string;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; field?: string | null };
}

export class ApiError extends Error {
  code: string;
  field: string | null;
  status: number;

  constructor(status: number, code: string, message: string, field: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

let accessToken: string | null = null;
let currentUser: SessionUser | null = null;

export function getUser(): SessionUser | null {
  return currentUser;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function setSession(token: string, user: SessionUser) {
  accessToken = token;
  currentUser = user;
}

export function clearSession() {
  accessToken = null;
  currentUser = null;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}

async function parseError(res: Response): Promise<ApiError> {
  let code = "INTERNAL";
  let message = "Something went wrong.";
  let field: string | null = null;
  try {
    const body = (await res.json()) as ApiErrorBody;
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
    field = body.error?.field ?? null;
  } catch {
    // non-JSON error body — keep defaults
  }
  return new ApiError(res.status, code, message, field);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, init);

  // One silent refresh-and-retry on 401 (access token expired, not revoked).
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, init);
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Mint a fresh access token from the HttpOnly refresh cookie (page load). */
export async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) {
      clearSession();
      return false;
    }
    const body = (await res.json()) as { accessToken: string; user: SessionUser };
    setSession(body.accessToken, body.user);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/** Restore a session if one exists; returns true when signed in. */
export async function bootstrapSession(): Promise<boolean> {
  if (accessToken && currentUser) return true;
  return tryRefresh();
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<SessionUser> {
  const body = await request<{ accessToken: string; user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession(body.accessToken, body.user);
  return body.user;
}

export interface RegisterResult {
  message: string;
  devOtp?: string;
}

export async function apiRegister(name: string, email: string, password: string): Promise<RegisterResult> {
  return request<RegisterResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function apiVerifyOtp(email: string, otp: string): Promise<SessionUser> {
  const body = await request<{ accessToken: string; user: SessionUser }>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  setSession(body.accessToken, body.user);
  return body.user;
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

// ── Profile + skills endpoints ───────────────────────────────────────────────

export async function apiGetMyProfile(): Promise<Profile | null> {
  const body = await request<{ profile: Profile | null }>("/api/profiles/me");
  return body.profile;
}

export async function apiUpdateProfile(input: {
  branch?: string | null;
  year?: number | null;
  cgpa?: number | null;
  cgpaPublic?: boolean;
  bio?: string | null;
}): Promise<Profile> {
  const body = await request<{ profile: Profile }>("/api/profiles/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.profile;
}

export async function apiGetSkills(): Promise<TaxonomySkill[]> {
  const body = await request<{ skills: TaxonomySkill[] }>("/api/skills");
  return body.skills;
}

export async function apiReplaceSkills(
  skills: { skillId: string; proficiency: string }[],
): Promise<Profile> {
  const body = await request<{ profile: Profile }>("/api/profiles/me/skills", {
    method: "PUT",
    body: JSON.stringify({ skills }),
  });
  return body.profile;
}
