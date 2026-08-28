import { NextResponse } from "next/server";
import { AppError } from "@/lib/http/errors";
import { readCookie, buildRefreshCookie } from "@/lib/security/cookies";
import {
  OAUTH_STATE_COOKIE,
  clearStateCookie,
  exchangeCodeForProfile,
  googleConfigured,
} from "@/lib/security/google";
import { loginWithGoogle } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/callback - Google redirects here with `code` + `state`.
 *
 * Verifies the CSRF state against the cookie, exchanges the code for a verified
 * profile, provisions/links the user, sets the SAME rotating refresh cookie as
 * password login, and redirects into the app. The client then bootstraps an
 * access token from that cookie via /api/auth/refresh - identical to every other
 * session, so Google users get the same theft-detection and rotation guarantees.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  try {
    if (!googleConfigured()) return fail("Google sign-in is not enabled.");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = readCookie(req, OAUTH_STATE_COOKIE);
    if (!code || !state || !cookieState || state !== cookieState) {
      return fail("Sign-in verification failed. Please try again.");
    }

    const redirectUri = `${origin}/api/auth/google/callback`;
    const profile = await exchangeCodeForProfile({ code, redirectUri });
    if (!profile.emailVerified) return fail("Your Google email address is not verified.");

    const session = await loginWithGoogle({
      email: profile.email,
      name: profile.name ?? "",
      userAgent: req.headers.get("user-agent"),
    });

    const res = NextResponse.redirect(`${origin}/opportunities`);
    res.headers.append(
      "Set-Cookie",
      buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt),
    );
    res.headers.append("Set-Cookie", clearStateCookie());
    return res;
  } catch (e) {
    return fail(e instanceof AppError ? e.message : "Google sign-in failed.");
  }
}
