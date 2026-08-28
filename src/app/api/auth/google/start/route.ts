import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { assertTrustedOrigin, resolveOrigin } from "@/lib/http/origin";
import { buildGoogleAuthUrl, buildStateCookie, googleConfigured } from "@/lib/security/google";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/start - begin the Google OAuth flow.
 *
 * Mints a CSRF `state`, stores it in a short-lived HttpOnly cookie, and redirects
 * the browser to Google's consent screen. The redirect URI comes from the
 * deployment's canonical origin (see lib/http/origin) and must be registered
 * verbatim in the Google Cloud client.
 */
export function GET(req: Request): NextResponse {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Google sign-in is not enabled.", field: null } },
      { status: 404 },
    );
  }

  const misconfigured = assertTrustedOrigin();
  if (misconfigured) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Google sign-in is misconfigured on this deployment.",
          field: null,
        },
      },
      { status: 500 },
    );
  }

  const origin = resolveOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildGoogleAuthUrl({ redirectUri, state }));
  res.headers.append("Set-Cookie", buildStateCookie(state));
  return res;
}
