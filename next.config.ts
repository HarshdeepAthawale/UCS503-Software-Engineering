import type { NextConfig } from "next";

/**
 * Security-relevant Next.js configuration.
 * - `poweredByHeader: false` removes the X-Powered-By fingerprinting header.
 * - `reactStrictMode` surfaces unsafe lifecycle usage early.
 * Response security headers (CSP, HSTS, etc.) are set centrally in `src/middleware.ts`
 * so they apply uniformly to API routes as well as pages.
 */

/**
 * Frontend-on-Vercel / backend-on-Render.
 *
 * The app is one Next.js monolith, so the SAME build is deployed to both hosts.
 * `BACKEND_ORIGIN` is what tells a deployment which half it is playing:
 *
 *   Render (the backend)  → unset. No rewrite; it serves its own /api routes.
 *   Vercel (the frontend) → https://<service>.onrender.com. Every /api request
 *                           is forwarded to Render.
 *   Local dev             → unset. Everything runs in one process, as before.
 *
 * Why a proxy instead of the browser calling Render directly: the refresh token
 * is an HttpOnly cookie with SameSite=Strict (src/lib/security/cookies.ts). A
 * cross-site XHR would never send it, and loosening it to SameSite=None makes it
 * a third-party cookie across vercel.app/onrender.com — blocked by default in
 * Safari and Firefox, which would break sessions for real users with no error.
 * Behind this rewrite the browser only ever sees ONE origin, so the cookie flags,
 * the `connect-src 'self'` CSP and the client's relative fetches all stay as they
 * are, and no CORS layer is needed.
 *
 * MUST be `beforeFiles`: a bare array of rewrites is applied only AFTER
 * filesystem routes are matched, and this repo *has* /api routes — they would win
 * and the proxy would silently never fire.
 */
function backendOrigin(): string | null {
  const raw = process.env.BACKEND_ORIGIN?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`BACKEND_ORIGIN is not a valid URL: ${raw}`);
  }
  // http would downgrade every API call, cookies included, to cleartext.
  if (url.protocol !== "https:") {
    throw new Error(`BACKEND_ORIGIN must be https, got ${url.protocol}//`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`BACKEND_ORIGIN must be a bare origin, got ${raw}`);
  }
  return url.origin;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma runs on the WASM query compiler (`engineType = "client"`, see
  // prisma/schema.prisma). Next's output file tracing follows `import`s, and the
  // client loads that .wasm by PATH at runtime, so tracing never sees it and it
  // was left out of the deployed function. Every query then died with
  //   ENOENT: /var/task/node_modules/.prisma/client/query_compiler_bg.wasm
  // in production while working locally, where node_modules is simply present.
  // Force it into every route's bundle.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/.prisma/client/*.wasm"],
  },
  async rewrites() {
    const origin = backendOrigin();
    if (!origin) return { beforeFiles: [], afterFiles: [], fallback: [] };
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${origin}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  experimental: {
    // Keep server-only secrets out of the client bundle.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
