import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";

/**
 * Google Calendar integration for meeting scheduling. Deliberately follows
 * the exact same "raw fetch, no SDK" shape as google.ts (Sign in with Google)
 * rather than pulling in the `googleapis` package - the surface we need is
 * three REST calls (token exchange/refresh, event insert, event delete), and
 * this keeps the dependency footprint at zero for it.
 *
 * This is an INCREMENTAL consent, separate from sign-in: only the person
 * scheduling a meeting (a poster or a team lead) grants calendar.events -
 * attendees are added by email on the organizer's own event and are never
 * asked to connect anything.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const CALENDAR_OAUTH_STATE_COOKIE = "nx_cal_oauth_state";
const CALENDAR_STATE_COOKIE_PATH = "/api/auth/google/calendar";

export function googleCalendarConfigured(): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET && !!env.TOKEN_ENCRYPTION_KEY;
}

export function buildGoogleCalendarAuthUrl(opts: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: `openid email ${CALENDAR_SCOPE}`,
    state: opts.state,
    // offline + consent guarantee a refresh_token even if this account
    // already granted sign-in access before (Google omits it on a repeat
    // grant unless the consent screen is forced to show again).
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface CalendarGrant {
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
  googleEmail: string;
}

/** Exchange a fresh authorization code for a refresh + access token pair. */
export async function exchangeCodeForCalendarTokens(opts: {
  code: string;
  redirectUri: string;
}): Promise<CalendarGrant> {
  if (!googleCalendarConfigured()) throw Errors.notFound();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw Errors.domainRule("Google rejected the calendar authorization. Please try again.");
  }
  const body = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!body.refresh_token || !body.access_token) {
    // Google omits refresh_token when this account already has one on file
    // for this client and `prompt=consent` was somehow bypassed - treat as a
    // configuration failure rather than silently storing a useless grant.
    throw Errors.domainRule(
      "Google did not return offline access. Please try connecting again.",
    );
  }

  let googleEmail = "";
  if (body.id_token) {
    try {
      const [, payload] = body.id_token.split(".");
      const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8"));
      googleEmail = typeof claims.email === "string" ? claims.email : "";
    } catch {
      /* googleEmail stays blank - cosmetic only, never used for auth decisions */
    }
  }

  return {
    refreshToken: body.refresh_token,
    accessToken: body.access_token,
    expiresInSeconds: body.expires_in ?? 3600,
    googleEmail,
  };
}

/** Mint a fresh access token from a stored refresh token before each API call. */
export async function refreshCalendarAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // invalid_grant means the user revoked access from their Google account
    // settings - the caller should treat this as "please reconnect", not a
    // generic 500.
    throw Errors.conflict("Google Calendar access was revoked. Please reconnect.");
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw Errors.internal("Google returned no access token.");
  return body.access_token;
}

export interface CreatedCalendarEvent {
  googleEventId: string;
  meetLink: string;
}

/**
 * Create a Calendar event with an auto-generated Meet link on the organizer's
 * primary calendar, inviting every attendee by email. `sendUpdates: all` means
 * Google emails the invite directly - an attendee needs no account on this
 * platform's Google integration to receive it.
 */
export async function createCalendarEvent(opts: {
  accessToken: string;
  title: string;
  description?: string;
  startTime: Date;
  durationMinutes: number;
  attendeeEmails: string[];
}): Promise<CreatedCalendarEvent> {
  const endTime = new Date(opts.startTime.getTime() + opts.durationMinutes * 60_000);
  const url = `${CALENDAR_EVENTS_ENDPOINT}?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: opts.title,
      description: opts.description,
      start: { dateTime: opts.startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      attendees: opts.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });
  if (!res.ok) {
    throw Errors.internal("Could not create the calendar event.");
  }
  const body = (await res.json()) as { id?: string; hangoutLink?: string };
  if (!body.id || !body.hangoutLink) {
    throw Errors.internal("Google did not return a Meet link for this event.");
  }
  return { googleEventId: body.id, meetLink: body.hangoutLink };
}

export async function cancelCalendarEvent(opts: {
  accessToken: string;
  googleEventId: string;
}): Promise<void> {
  const url = `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(opts.googleEventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  // 410 Gone = already deleted on Google's side - treat as success (idempotent).
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw Errors.internal("Could not cancel the calendar event.");
  }
}

/** Revoke this refresh token with Google entirely - used by the "disconnect" action. */
export async function revokeCalendarAccess(refreshToken: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => {
    /* best-effort - the local credential row is deleted regardless */
  });
}

// ── Short-lived CSRF state cookie (mirrors google.ts, separate path) ─────────

export function buildCalendarStateCookie(state: string): string {
  return [
    `${CALENDAR_OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}`,
    `Path=${CALENDAR_STATE_COOKIE_PATH}`,
    "Max-Age=600",
    "HttpOnly",
    env.ALLOW_INSECURE_COOKIES ? "" : "Secure",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCalendarStateCookie(): string {
  return [
    `${CALENDAR_OAUTH_STATE_COOKIE}=`,
    `Path=${CALENDAR_STATE_COOKIE_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    env.ALLOW_INSECURE_COOKIES ? "" : "Secure",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}
