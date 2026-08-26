import { handler, ok } from "@/lib/http/respond";
import { logout } from "@/lib/services/auth.service";
import { readCookie, clearRefreshCookie, REFRESH_COOKIE } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 * Revokes the session server-side (whole refresh family) and clears the cookie
 * client-side. Idempotent and always returns 200 — logging out is never an error.
 */
export const POST = handler(async (req) => {
  const raw = readCookie(req, REFRESH_COOKIE);
  await logout(raw);
  return ok({ message: "Signed out." }, 200, { "Set-Cookie": clearRefreshCookie() });
});
