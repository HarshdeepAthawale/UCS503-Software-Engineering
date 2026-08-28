import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/security/access-token";

/**
 * Edge middleware — the OUTERMOST security layer (defense-in-depth).
 *
 * 1. Security headers on every response (codeguard-0-client-side-web-security):
 *    HSTS, a strict CSP, no sniffing, no framing, tight referrer/permissions.
 * 2. A COARSE authentication gate: protected API paths must carry a structurally
 *    valid, unexpired access token, else 401 before the handler runs. This is a
 *    cheap early reject — it is NOT the authoritative check. Fine-grained RBAC and
 *    fresh role/status come from the database inside each route (see iam/guard.ts),
 *    so a token cannot outrun a revocation.
 *
 * jose verification is WebCrypto-based and runs on the edge; Prisma does not, so
 * no database lookups happen here by design.
 */

// Paths under /api that skip the edge USER-JWT gate. Public auth endpoints, plus
// scheduled-job endpoints under /api/cron (authenticated by CRON_SECRET at the
// route layer, not by a user token — see http/cron-auth.ts).
const PUBLIC_API = [
  "/api/health",
  "/api/auth/register",
  "/api/auth/verify-otp",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/otp-login",
  "/api/auth/google",
  "/api/cron",
];

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  const isApi = pathname.startsWith("/api/");
  const isPublic = PUBLIC_API.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isApi && !isPublic) {
    const header = req.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) {
      return securityHeaders(
        NextResponse.json(
          { error: { code: "UNAUTHENTICATED", message: "Authentication required.", field: null } },
          { status: 401 },
        ),
      );
    }
  }

  return securityHeaders(NextResponse.next());
}

// Apply to all API routes and app pages, skipping static assets.
export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
