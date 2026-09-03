"use client";

/**
 * Client-side API layer for the app screens.
 *
 * Security model (mirrors docs/Security.md):
 * - The refresh token lives ONLY in the HttpOnly cookie (Path=/api/auth) - JS
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

export interface Project {
  id: string;
  title: string;
  description: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  createdAt: string;
}

export interface ResumeMeta {
  name: string | null;
  size: number | null;
  uploadedAt: string | null;
}

export interface ResumeView extends ResumeMeta {
  previewUrl: string;
  downloadUrl: string;
}

export interface Profile {
  userId: string;
  name: string;
  /** Account type (STUDENT/FACULTY/...) — see `headline` for what they do. */
  role: string;
  branch: string | null;
  year: number | null;
  bio: string | null;
  /** One-line self-description, e.g. "Security researcher · binary exploitation". */
  headline: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  /** Posting types this member is open to; empty = not stated. */
  openTo: OppType[];
  hoursPerWeek: number | null;
  cgpa: number | null;
  cgpaPublic: boolean;
  /** Active/current backlogs (self-reported), matched against a posting's `maxBacklogs`. */
  backlogs: number | null;
  skills: { id: string; name: string; domain: string; proficiency: string }[];
  projects: Project[];
  resume: ResumeMeta | null;
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
  // FormData bodies must set their own multipart Content-Type (with the
  // boundary) - the browser does that only when we DON'T set the header.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) {
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
    // non-JSON error body - keep defaults
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

/**
 * In-flight refresh, shared by every concurrent caller.
 *
 * The refresh cookie ROTATES on use and the server runs reuse detection, so two
 * refreshes racing on the same cookie is not merely a wasted round-trip: the
 * second presents an already-spent token and looks exactly like theft, which
 * revokes the whole family and signs the user out. A page that mounts two
 * components calling `bootstrapSession`, or fires parallel requests that both
 * 401, could do precisely that.
 */
let refreshInFlight: Promise<boolean> | null = null;

/** Mint a fresh access token from the HttpOnly refresh cookie (page load). */
export function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
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
    } finally {
      // Cleared inside the same promise so the next caller starts a new
      // request rather than joining this settled one.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
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

/**
 * Another member's profile, or null when there is none to show. The server
 * decides what comes back: CGPA is stripped unless the student made it public,
 * and `resume` is null unless the viewer is allowed to see it — so this payload
 * is already safe to render as-is.
 */
export async function apiGetProfile(userId: string): Promise<Profile | null> {
  try {
    const body = await request<{ profile: Profile }>(`/api/profiles/${userId}`);
    return body.profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function apiUpdateProfile(input: {
  branch?: string | null;
  year?: number | null;
  cgpa?: number | null;
  cgpaPublic?: boolean;
  backlogs?: number | null;
  bio?: string | null;
  headline?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  openTo?: OppType[];
  hoursPerWeek?: number | null;
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
  skills: { name: string; proficiency: string }[],
): Promise<Profile> {
  const body = await request<{ profile: Profile }>("/api/profiles/me/skills", {
    method: "PUT",
    body: JSON.stringify({ skills }),
  });
  return body.profile;
}

// ── Portfolio projects (T-37; M2) ────────────────────────────────────────────

export interface ProjectInput {
  title: string;
  description?: string | null;
  repoUrl?: string | null;
  liveUrl?: string | null;
}

export async function apiAddProject(input: ProjectInput): Promise<Project> {
  const body = await request<{ project: Project }>("/api/profiles/me/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.project;
}

export async function apiUpdateProject(id: string, input: Partial<ProjectInput>): Promise<Project> {
  const body = await request<{ project: Project }>(`/api/profiles/me/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.project;
}

export async function apiRemoveProject(id: string): Promise<void> {
  await request<void>(`/api/profiles/me/projects/${id}`, { method: "DELETE" });
}

// ── Résumé (T-44; M2) ────────────────────────────────────────────────────────

export async function apiUploadResume(file: File): Promise<ResumeMeta> {
  const form = new FormData();
  form.append("file", file);
  const body = await request<{ resume: ResumeMeta }>("/api/profiles/me/resume", {
    method: "POST",
    body: form,
  });
  return body.resume;
}

export async function apiRemoveResume(): Promise<void> {
  await request<void>("/api/profiles/me/resume", { method: "DELETE" });
}

/** Résumé view (metadata + signed URLs) for a user, or null when there is none. */
export async function apiGetResume(userId: string): Promise<ResumeView | null> {
  try {
    const body = await request<{ resume: ResumeView }>(`/api/profiles/${userId}/resume`);
    return body.resume;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
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
  /** Eligibility filters (docs/PRD M3). Empty array = every branch eligible. */
  eligibleBranches: string[];
  minCgpa: number | null;
  maxBacklogs: number | null;
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

export type OpportunitySort = "recent" | "deadline" | "seats";

export interface OpportunityListParams {
  q?: string;
  type?: OppType;
  domain?: string;
  stipend?: "true" | "false";
  skillId?: string;
  sort?: OpportunitySort;
  cursor?: string;
  limit?: number;
}

export async function apiListOpportunities(
  params: OpportunityListParams = {},
): Promise<{ opportunities: Opportunity[]; nextCursor: string | null; sort: OpportunitySort }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ opportunities: Opportunity[]; nextCursor: string | null; sort: OpportunitySort }>(
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
  eligibleBranches?: string[];
  minCgpa?: number | null;
  maxBacklogs?: number | null;
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

export interface OpportunityUpdateInput {
  title?: string;
  description?: string;
  domain?: string;
  duration?: string | null;
  stipend?: boolean;
  seatCount?: number;
  deadline?: string;
  slaPledge?: SlaPledge;
  skills?: { skillId: string; requirement: SkillRequirement }[];
  eligibleBranches?: string[];
  minCgpa?: number | null;
  maxBacklogs?: number | null;
}

export async function apiUpdateOpportunity(
  id: string,
  input: OpportunityUpdateInput,
): Promise<Opportunity> {
  const body = await request<{ opportunity: Opportunity }>(`/api/opportunities/${id}`, {
    method: "PATCH",
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
  /** `branch`/`cgpa` are visible here regardless of `cgpaPublic` - the student
   *  applied to this posting, which is the poster's shortlisting scope. */
  student: {
    id: string;
    name: string;
    branch: string | null;
    cgpa: number | null;
    backlogs: number | null;
  };
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
  // RECEIVED is no longer an offered poster transition (see application-state.ts).
  toState: Exclude<AppState, "APPLIED" | "WITHDRAWN" | "RECEIVED">,
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

/** One conversation: an application's thread, plus who's on the other end. */
export interface MessageThreadSummary {
  applicationId: string;
  opportunity: { id: string; title: string };
  status: AppState;
  /** The other participant - the professor/poster for a student, the
   *  applicant for a poster. */
  counterpart: { id: string; name: string; role: string };
  lastMessage: { body: string; createdAt: string; senderId: string };
}

/**
 * Every conversation the caller is part of, across all their applications -
 * as a student, every professor they've messaged; as a poster, every
 * applicant. Newest message first. Only applications with at least one
 * message sent are included.
 */
export async function apiListMyThreads(): Promise<MessageThreadSummary[]> {
  const body = await request<{ threads: MessageThreadSummary[] }>("/api/messages");
  return body.threads;
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

// ── Passwordless OTP login (alumni + convenience) ────────────────────────────

export async function apiRequestLoginOtp(email: string): Promise<{ devOtp?: string }> {
  return request<{ devOtp?: string }>("/api/auth/otp-login/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiVerifyLoginOtp(email: string, otp: string): Promise<SessionUser> {
  const body = await request<{ accessToken: string; user: SessionUser }>(
    "/api/auth/otp-login/verify",
    { method: "POST", body: JSON.stringify({ email, otp }) },
  );
  setSession(body.accessToken, body.user);
  return body.user;
}

// ── Admin console (Identity v2) ──────────────────────────────────────────────

export interface AdminOverview {
  users: Record<string, number>;
  opportunities: { live: number; atRisk: number };
  applications: number;
  pendingClaims: number;
  openFlags: number;
}

export type FlagReason = "SPAM" | "MISLEADING" | "INAPPROPRIATE" | "DUPLICATE" | "OTHER";

export interface AdminFlag {
  id: string;
  reason: FlagReason;
  detail: string | null;
  createdAt: string;
  reporter: { id: string; name: string };
  opportunity: {
    id: string;
    title: string;
    status: string;
    deletedAt: string | null;
    poster: { name: string };
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "FACULTY" | "ALUMNI" | "ADMIN";
  status: string;
  createdAt: string;
}

export interface AllowlistEntry {
  id: string;
  email: string;
  note: string | null;
  createdAt: string;
}

export async function apiAdminOverview(): Promise<AdminOverview> {
  const body = await request<{ overview: AdminOverview }>("/api/admin/overview");
  return body.overview;
}

export interface InstituteAnalytics {
  applications: {
    total: number;
    resolved: number;
    resolutionRate: number;
    acknowledged: number;
    medianTtaHours: number | null;
  };
  seats: { total: number; filled: number; fillRate: number };
  byAppState: Record<string, number>;
  byOppType: Record<string, number>;
  byOppStatus: Record<string, number>;
  perDay: { day: string; count: number }[];
}

export async function apiAdminAnalytics(): Promise<InstituteAnalytics> {
  const body = await request<{ analytics: InstituteAnalytics }>("/api/admin/analytics");
  return body.analytics;
}

export async function apiAdminListUsers(params: {
  q?: string;
  role?: string;
  status?: string;
} = {}): Promise<AdminUser[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const body = await request<{ users: AdminUser[] }>(`/api/admin/users${suffix}`);
  return body.users;
}

export async function apiAdminUpdateUser(
  id: string,
  input: { role?: "STUDENT" | "FACULTY" | "ALUMNI"; status?: "ACTIVE" | "SUSPENDED" },
): Promise<AdminUser> {
  const body = await request<{ user: AdminUser }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.user;
}

export async function apiAdminProvisionAlumni(input: {
  name: string;
  email: string;
  rollNo?: string;
  gradYear?: number;
  degree?: string;
  proofUrl?: string;
}): Promise<AdminUser> {
  const body = await request<{ user: AdminUser }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.user;
}

export async function apiAdminListAllowlist(): Promise<AllowlistEntry[]> {
  const body = await request<{ entries: AllowlistEntry[] }>("/api/admin/faculty-allowlist");
  return body.entries;
}

export async function apiAdminAddAllowlist(email: string, note?: string): Promise<AllowlistEntry> {
  const body = await request<{ entry: AllowlistEntry }>("/api/admin/faculty-allowlist", {
    method: "POST",
    body: JSON.stringify(note ? { email, note } : { email }),
  });
  return body.entry;
}

export async function apiAdminRemoveAllowlist(id: string): Promise<void> {
  await request<{ id: string }>(`/api/admin/faculty-allowlist/${id}`, { method: "DELETE" });
}

// ── Moderation flags (T-36, M9) ──────────────────────────────────────────────

/** Report a posting (student/faculty/alumni). */
export async function apiFlagOpportunity(
  opportunityId: string,
  input: { reason: FlagReason; detail?: string },
): Promise<{ id: string }> {
  const body = await request<{ flag: { id: string } }>(
    `/api/opportunities/${opportunityId}/flag`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return body.flag;
}

export async function apiAdminListFlags(): Promise<AdminFlag[]> {
  const body = await request<{ flags: AdminFlag[] }>("/api/admin/flags");
  return body.flags;
}

export async function apiAdminResolveFlag(
  id: string,
  input: { decision: "RESOLVED" | "DISMISSED"; note?: string; removePosting?: boolean },
): Promise<{ id: string; status: string; removedPosting: boolean }> {
  return request<{ id: string; status: string; removedPosting: boolean }>(
    `/api/admin/flags/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
