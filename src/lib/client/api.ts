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

// ── Opportunities (T-09 / T-11) ──────────────────────────────────────────────

export type OppType =
  | "RESEARCH"
  | "INTERNSHIP"
  | "TA"
  | "HACKATHON_TEAM"
  | "MICRO_TASK"
  | "REFERRAL";
export type OppStatus = "DRAFT" | "LIVE" | "AT_RISK" | "EXPIRED" | "CLOSED";
export type SlaPledge = "H24" | "H48" | "WEEK";
export type SkillRequirement = "REQUIRED" | "PREFERRED";
export type ResponsivenessBadge =
  | "HIGHLY_RESPONSIVE"
  | "RESPONSIVE"
  | "SLOW"
  | "UNRESPONSIVE"
  | "NEW";

export interface OppSkill {
  id: string;
  name: string;
  domain: string;
  requirement: SkillRequirement;
}

export interface Opportunity {
  id: string;
  type: OppType;
  title: string;
  description: string;
  domain: string;
  duration: string | null;
  stipend: boolean;
  seatCount: number;
  seatsFilled: number;
  deadline: string;
  slaPledge: SlaPledge;
  status: OppStatus;
  createdAt: string;
  poster: {
    id: string;
    name: string;
    role: string;
    responsiveness?: {
      badge: ResponsivenessBadge;
      medianTtaHours: number | null;
      sampleSize: number;
    };
  };
  skills: OppSkill[];
}

export interface OpportunityListParams {
  q?: string;
  type?: OppType;
  domain?: string;
  stipend?: "true" | "false";
  skillId?: string;
  cursor?: string;
  limit?: number;
}

export async function apiListOpportunities(
  params: OpportunityListParams = {},
): Promise<{ opportunities: Opportunity[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ opportunities: Opportunity[]; nextCursor: string | null }>(
    `/api/opportunities${suffix}`,
  );
}

export async function apiGetOpportunity(id: string): Promise<Opportunity> {
  const body = await request<{ opportunity: Opportunity }>(`/api/opportunities/${id}`);
  return body.opportunity;
}

export interface OpportunityCreateInput {
  type: OppType;
  title: string;
  description: string;
  domain: string;
  duration?: string | null;
  stipend?: boolean;
  seatCount?: number;
  deadline: string;
  slaPledge: SlaPledge;
  skills?: { skillId: string; requirement: SkillRequirement }[];
}

export async function apiCreateOpportunity(
  input: OpportunityCreateInput,
): Promise<Opportunity> {
  const body = await request<{ opportunity: Opportunity }>("/api/opportunities", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.opportunity;
}

export async function apiCloseOpportunity(id: string): Promise<{ id: string; status: OppStatus }> {
  return request<{ id: string; status: OppStatus }>(`/api/opportunities/${id}`, {
    method: "POST",
  });
}

// ── Applications (T-12 / T-13) ───────────────────────────────────────────────

export type AppState =
  | "APPLIED"
  | "RECEIVED"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN";
export type RejectionCode =
  | "SKILL_MISMATCH"
  | "SEATS_FILLED"
  | "TIMING_CONFLICT"
  | "PROFILE_INCOMPLETE"
  | "STRONGER_APPLICANTS"
  | "OTHER";

export interface MyApplication {
  id: string;
  status: AppState;
  appliedAt: string;
  firstTransitionAt: string | null;
  rejectionCode: RejectionCode | null;
  opportunity: {
    id: string;
    title: string;
    type: OppType;
    status: OppStatus;
    deadline: string;
  };
}

export interface ApplicationEvent {
  fromState: AppState | null;
  toState: AppState;
  note: string | null;
  createdAt: string;
}

export interface Applicant {
  id: string;
  status: AppState;
  appliedAt: string;
  firstTransitionAt: string | null;
  rejectionCode: RejectionCode | null;
  student: { id: string; name: string };
  events: ApplicationEvent[];
}

export async function apiApply(
  opportunityId: string,
  note?: string,
): Promise<{ id: string; status: AppState }> {
  const body = await request<{ application: { id: string; status: AppState } }>(
    `/api/opportunities/${opportunityId}/applications`,
    { method: "POST", body: JSON.stringify(note ? { note } : {}) },
  );
  return body.application;
}

export async function apiListMyApplications(): Promise<MyApplication[]> {
  const body = await request<{ applications: MyApplication[] }>("/api/applications");
  return body.applications;
}

export async function apiListApplicants(opportunityId: string): Promise<Applicant[]> {
  const body = await request<{ applicants: Applicant[] }>(
    `/api/opportunities/${opportunityId}/applications`,
  );
  return body.applicants;
}

export async function apiTransition(
  applicationId: string,
  toState: Exclude<AppState, "APPLIED" | "WITHDRAWN">,
  opts: { note?: string; rejectionCode?: RejectionCode } = {},
): Promise<{ id: string; status: AppState }> {
  const body = await request<{ application: { id: string; status: AppState } }>(
    `/api/applications/${applicationId}`,
    { method: "PATCH", body: JSON.stringify({ toState, ...opts }) },
  );
  return body.application;
}

export async function apiWithdraw(
  applicationId: string,
): Promise<{ id: string; status: AppState }> {
  const body = await request<{ application: { id: string; status: AppState } }>(
    `/api/applications/${applicationId}/withdraw`,
    { method: "POST" },
  );
  return body.application;
}

// ── Messaging (T-16) ─────────────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export async function apiListMessages(applicationId: string): Promise<Message[]> {
  const body = await request<{ messages: Message[] }>(
    `/api/applications/${applicationId}/messages`,
  );
  return body.messages;
}

export async function apiSendMessage(applicationId: string, text: string): Promise<Message> {
  const body = await request<{ message: Message }>(
    `/api/applications/${applicationId}/messages`,
    { method: "POST", body: JSON.stringify({ body: text }) },
  );
  return body.message;
}

// ── Notifications (T-17) ─────────────────────────────────────────────────────

export type NotifFreq = "IMMEDIATE" | "DAILY" | "WEEKLY";

export interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function apiListNotifications(): Promise<{
  notifications: Notification[];
  unread: number;
}> {
  return request<{ notifications: Notification[]; unread: number }>("/api/notifications");
}

export async function apiMarkNotificationsRead(ids?: string[]): Promise<number> {
  const body = await request<{ marked: number }>("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(ids && ids.length ? { ids } : {}),
  });
  return body.marked;
}

export async function apiGetNotificationPref(): Promise<{
  frequency: NotifFreq;
  lastDigestAt: string | null;
}> {
  const body = await request<{ preference: { frequency: NotifFreq; lastDigestAt: string | null } }>(
    "/api/notifications/preferences",
  );
  return body.preference;
}

export async function apiSetNotificationPref(frequency: NotifFreq): Promise<NotifFreq> {
  const body = await request<{ preference: { frequency: NotifFreq } }>(
    "/api/notifications/preferences",
    { method: "PUT", body: JSON.stringify({ frequency }) },
  );
  return body.preference.frequency;
}
