/**
 * Paths under /api that skip the edge user-JWT gate in middleware.ts: the
 * public auth endpoints, plus scheduled-job endpoints under /api/cron
 * (authenticated by CRON_SECRET at the route layer, not by a user token - see
 * http/cron-auth.ts). Pure and dependency-free so the edge runtime can use it.
 */
const PUBLIC_API = [
  "/api/health",
  "/api/auth/register",
  "/api/auth/register-alumni",
  "/api/auth/verify-otp",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/otp-login",
  "/api/auth/password-reset",
  "/api/auth/google",
  "/api/cron",
];

/** True for a listed path or anything beneath it - never a look-alike prefix. */
export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
