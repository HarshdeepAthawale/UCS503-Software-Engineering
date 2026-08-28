import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { refresh } from "@/lib/services/auth.service";
import { readCookie, buildRefreshCookie, REFRESH_COOKIE } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and returns a new access token. The refresh token is
 * read only from the HttpOnly cookie (SameSite=Strict), so this endpoint is not
 * usable cross-site - our CSRF defence. Reuse of a rotated token invalidates the
 * whole family (theft detection) inside the service.
 */
export const POST = handler(async (req) => {
  const raw = readCookie(req, REFRESH_COOKIE);
  if (!raw) throw Errors.unauthenticated("No active session.");

  const session = await refresh({
    rawToken: raw,
    userAgent: req.headers.get("user-agent"),
  });

  const cookie = buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt);
  return ok(
    { accessToken: session.accessToken, user: session.user },
    200,
    { "Set-Cookie": cookie },
  );
});
