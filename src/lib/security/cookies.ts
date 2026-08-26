import { env } from "@/lib/env";

/**
 * Refresh-token cookie. Flags follow codeguard-0-session-management-and-cookies:
 *  - HttpOnly  → unreadable from JavaScript, so XSS cannot exfiltrate it.
 *  - Secure    → HTTPS-only (relaxed only for local dev, never in production).
 *  - SameSite=Strict → the cookie is not sent on cross-site requests, which is
 *    our primary CSRF defence for the refresh/logout endpoints.
 *  - Path=/api/auth → the token is only ever sent to the auth endpoints.
 */
export const REFRESH_COOKIE = "nx_rt";
const COOKIE_PATH = "/api/auth";

export function buildRefreshCookie(raw: string, expiresAt: Date): string {
  return serialize(REFRESH_COOKIE, raw, {
    httpOnly: true,
    secure: !env.ALLOW_INSECURE_COOKIES,
    sameSite: "Strict",
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(): string {
  return serialize(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: !env.ALLOW_INSECURE_COOKIES,
    sameSite: "Strict",
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  expires?: Date;
  maxAge?: number;
}

function serialize(name: string, value: string, o: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (o.path) parts.push(`Path=${o.path}`);
  if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`);
  if (o.maxAge !== undefined) parts.push(`Max-Age=${o.maxAge}`);
  if (o.httpOnly) parts.push("HttpOnly");
  if (o.secure) parts.push("Secure");
  if (o.sameSite) parts.push(`SameSite=${o.sameSite}`);
  return parts.join("; ");
}
