import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/security/access-token";
import { isPublicApi } from "@/lib/http/public-api";

/**
 * Edge middleware - the OUTERMOST security layer (defense-in-depth).
 *
 * 1. Security headers on every response (codeguard-0-client-side-web-security):
 *    HSTS, a strict CSP, no sniffing, no framing, tight referrer/permissions.
 * 2. A COARSE authentication gate: protected API paths must carry a structurally
 *    valid, unexpired access token, else 401 before the handler runs. This is a
 *    cheap early reject - it is NOT the authoritative check. Fine-grained RBAC and
 *    fresh role/status come from the database inside each route (see iam/guard.ts),
 *    so a token cannot outrun a revocation.
 *
 * jose verification is WebCrypto-based and runs on the edge; Prisma does not, so
 * no database lookups happen here by design.
 */


function securityHeaders(res: NextResponse, nonce: string): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  // Next.js emits its own inline scripts on every HTML response - the RSC
  // flight payload arrives as a series of `self.__next_f.push(...)` tags - and
  // their contents change with the page, so they cannot be hash-allowlisted.
  //
  // **This directive previously carried a single sha256 hash for the pre-paint
  // theme script and nothing else, which blocked all of them.** The visible
  // symptom was that the theme toggle did nothing; the actual symptom was that
  // React never hydrated, so every button, link handler and form on the site
  // was inert. A CSP that breaks hydration fails open in the worst way: the
  // markup still renders, so the page looks fine.
  //
  // A per-request nonce is the fix. Next.js reads it off the request's own CSP
  // header and stamps it onto the scripts it generates; `strict-dynamic` then
  // lets those trusted scripts load the chunk graph without host allowlisting.
  // Note that `strict-dynamic` makes `'self'` ignored for scripts, which is
  // the point - trust flows from the nonce, not from an origin.
  const isDev = process.env.NODE_ENV !== "production";

  // Résumé PDFs are previewed in an <iframe> pointing at a Supabase Storage
  // signed URL, so that origin must be allowed in frame-src (which otherwise
  // falls back to default-src 'self' and blocks the preview). Derived from
  // SUPABASE_URL; absent when the feature is not configured.
  const supabaseOrigin = originOf(process.env.SUPABASE_URL);
  const frameSrc = `frame-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`;

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // 'unsafe-eval' is DEVELOPMENT ONLY: the dev server compiles modules
      // through eval to keep source maps cheap, and HMR cannot run without it.
      // It must never reach production, which is why it is gated rather than
      // simply present.
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      // The dev server pushes rebuilds over a websocket.
      `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
      frameSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  return res;
}

/** The scheme+host of a URL, or null when unset/malformed. Never throws. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Local dev: 127.0.0.1 and localhost are different origins to Google OAuth.
  // Canonicalise to localhost so the redirect_uri matches Google Cloud Console.
  if (
    process.env.NODE_ENV !== "production" &&
    req.nextUrl.hostname === "127.0.0.1"
  ) {
    const url = req.nextUrl.clone();
    url.hostname = "localhost";
    return NextResponse.redirect(url);
  }

  // One nonce per response. `crypto` is the WebCrypto global on the edge
  // runtime; `Math.random` would not be acceptable here because a guessable
  // nonce is the same as no nonce at all.
  const nonce = btoa(crypto.randomUUID());

  const isApi = pathname.startsWith("/api/");
  const isPublic = isPublicApi(pathname);

  // On the FRONTEND deployment (BACKEND_ORIGIN set) this middleware runs in
  // front of a rewrite that forwards /api/* to the backend — and it runs BEFORE
  // that rewrite. Gating here would verify the token with THIS deployment's
  // JWT_ACCESS_SECRET, but the token was signed by the backend with ITS secret.
  // The two are deliberately not shared: duplicating a signing key onto a second
  // host to satisfy a redundant check is a worse trade than skipping the check.
  //
  // Without this, every authenticated request 401s at the edge and never
  // reaches the backend at all — refresh works (it is public), then every call
  // after it fails, which looks exactly like a broken session.
  //
  // Nothing is weakened: this gate was only ever a cheap early reject, never
  // authoritative. The backend re-verifies the token and reloads role and status
  // from the database on every request (see iam/guard.ts).
  const isProxyFrontend = Boolean(process.env.BACKEND_ORIGIN);

  if (isApi && !isPublic && !isProxyFrontend) {
    const header = req.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) {
      return securityHeaders(
        NextResponse.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required.",
              field: null,
            },
          },
          { status: 401 },
        ),
        nonce,
      );
    }
  }

  // The nonce also reaches the render pass as `x-nonce`, for any server
  // component that has to stamp an inline <script> of its own (none today -
  // the theme script went with dark mode).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  return securityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
}

// Apply to all API routes and app pages, skipping static assets.
export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
