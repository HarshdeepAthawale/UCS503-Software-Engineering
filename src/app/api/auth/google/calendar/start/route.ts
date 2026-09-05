import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { assertTrustedOrigin, resolveOrigin } from "@/lib/http/origin";
import {
  buildGoogleCalendarAuthUrl,
  buildCalendarStateCookie,
  googleCalendarConfigured,
} from "@/lib/security/google-calendar";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/calendar/start?returnTo=/applications/:id
 *
 * Begins INCREMENTAL Google consent for the calendar.events scope - separate
 * from sign-in (google/start), and only reachable by someone already using
 * the app (the "Connect Google Calendar" action). `returnTo` is restricted to
 * the pages that can trigger this (application/team detail), never an
 * arbitrary redirect target.
 */
const RETURN_TO_PATTERN =
  /^\/(applications|teams)\/[0-9a-f-]{36}(\/[a-z-]*)?$|^\/opportunities\/[0-9a-f-]{36}\/applicants$|^\/profile$/i;

export function GET(req: Request): NextResponse {
  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Calendar scheduling is not enabled.", field: null } },
      { status: 404 },
    );
  }
  const misconfigured = assertTrustedOrigin();
  if (misconfigured) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Calendar scheduling is misconfigured.", field: null } },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const requestedReturnTo = url.searchParams.get("returnTo") ?? "";
  const returnTo = RETURN_TO_PATTERN.test(requestedReturnTo) ? requestedReturnTo : "/opportunities";

  const origin = resolveOrigin(req);
  const redirectUri = `${origin}/api/auth/google/calendar/callback`;
  // The CSRF state also carries returnTo (bound to the same signed cookie
  // check as the state itself, so it cannot be tampered with independently).
  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}|${returnTo}`;

  const res = NextResponse.redirect(buildGoogleCalendarAuthUrl({ redirectUri, state }));
  res.headers.append("Set-Cookie", buildCalendarStateCookie(state));
  return res;
}
