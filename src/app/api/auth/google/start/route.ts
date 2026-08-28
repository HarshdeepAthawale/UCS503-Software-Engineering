import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl, buildStateCookie, googleConfigured } from "@/lib/security/google";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/start - begin the Google OAuth flow.
 *
 * Mints a CSRF `state`, stores it in a short-lived HttpOnly cookie, and redirects
 * the browser to Google's consent screen. The redirect URI is derived from the
 * request origin so it works in dev and prod without extra config (the origin
 * must be registered in the Google Cloud client).
 */
export function GET(req: Request): NextResponse {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Google sign-in is not enabled.", field: null } },
      { status: 404 },
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildGoogleAuthUrl({ redirectUri, state }));
  res.headers.append("Set-Cookie", buildStateCookie(state));
  return res;
}
