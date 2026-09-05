import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { assertTrustedOrigin, resolveOrigin } from "@/lib/http/origin";
import { audit } from "@/lib/security/audit";
import { readCookie, buildRefreshCookie, REFRESH_COOKIE } from "@/lib/security/cookies";
import {
  CALENDAR_OAUTH_STATE_COOKIE,
  clearCalendarStateCookie,
  exchangeCodeForCalendarTokens,
  googleCalendarConfigured,
} from "@/lib/security/google-calendar";
import { encryptSecret } from "@/lib/security/token-crypto";
import { refresh as refreshSession } from "@/lib/services/auth.service";

export const runtime = "nodejs";

const RETURN_TO_PATTERN =
  /^\/(applications|teams)\/[0-9a-f-]{36}(\/[a-z-]*)?$|^\/opportunities\/[0-9a-f-]{36}\/applicants$|^\/profile$/i;

/**
 * GET /api/auth/google/calendar/callback - Google redirects here with a fresh
 * `code` after the user grants (or denies) calendar.events.
 *
 * This is a plain browser navigation, not an authenticated fetch, so there is
 * no Authorization header to resolve WHO is connecting - identity comes from
 * the same `nx_rt` refresh-token cookie the SPA already relies on to restore
 * a session (auth.service.ts's `refresh()`), which also rotates it, exactly
 * as an ordinary /api/auth/refresh call would.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const origin = resolveOrigin(req);

  const cookieState = readCookie(req, CALENDAR_OAUTH_STATE_COOKIE);
  const [, returnToFromState] = (cookieState ?? "").split("|");
  const returnTo = returnToFromState && RETURN_TO_PATTERN.test(returnToFromState) ? returnToFromState : "/opportunities";

  const fail = (msg: string) => {
    const res = NextResponse.redirect(
      `${origin}${returnTo}?calendarError=${encodeURIComponent(msg)}`,
    );
    res.headers.append("Set-Cookie", clearCalendarStateCookie());
    return res;
  };

  try {
    if (!googleCalendarConfigured()) return fail("Calendar scheduling is not enabled.");
    if (assertTrustedOrigin()) return fail("Calendar scheduling is misconfigured.");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !cookieState || state !== cookieState) {
      return fail("Verification failed. Please try connecting again.");
    }

    const rawRefreshToken = readCookie(req, REFRESH_COOKIE);
    if (!rawRefreshToken) return fail("Your session expired. Please sign in and try again.");

    const session = await refreshSession({
      rawToken: rawRefreshToken,
      userAgent: req.headers.get("user-agent"),
    });

    const redirectUri = `${origin}/api/auth/google/calendar/callback`;
    const grant = await exchangeCodeForCalendarTokens({ code, redirectUri });

    await prisma.googleCalendarCredential.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        encryptedRefreshToken: encryptSecret(grant.refreshToken),
        googleEmail: grant.googleEmail,
        scope: "calendar.events",
      },
      update: {
        encryptedRefreshToken: encryptSecret(grant.refreshToken),
        googleEmail: grant.googleEmail,
        scope: "calendar.events",
        revokedAt: null,
      },
    });
    await audit({ action: "calendar.connected", actorId: session.user.id });

    const res = NextResponse.redirect(`${origin}${returnTo}?calendarConnected=1`);
    res.headers.append(
      "Set-Cookie",
      buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt),
    );
    res.headers.append("Set-Cookie", clearCalendarStateCookie());
    return res;
  } catch (e) {
    return fail(e instanceof AppError ? e.message : "Connecting Google Calendar failed.");
  }
}
