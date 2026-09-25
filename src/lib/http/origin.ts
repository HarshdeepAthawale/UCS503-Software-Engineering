import { env } from "@/lib/env";

/**
 * The public origin of this deployment, used to build absolute URLs that leave
 * the server: the Google OAuth `redirect_uri` and the post-login redirect.
 *
 * Resolution order, most trustworthy first:
 *
 *  1. `APP_ORIGIN` - configured, not derived. The only source a request cannot
 *     influence, so it is the only one safe to hand to an OAuth provider. Set
 *     it when the deployment has a custom domain, or when hosting is not Vercel.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` - injected by Vercel, and equally beyond a
 *     request's influence. It carries the project's stable production domain,
 *     so on Vercel the flow needs no manual configuration at all.
 *  3. `x-forwarded-proto` + `x-forwarded-host` - set by the hosting proxy.
 *     Correct behind a TLS-terminating edge, where `req.url` can report the
 *     internal `http://` origin and yield a redirect_uri Google never saw.
 *  4. `new URL(req.url).origin` - the local-dev case (`http://localhost:3000`).
 *
 * Steps 3 and 4 read request-controlled headers, which is fine in dev but means
 * a spoofed `Host` could steer the post-login redirect at an attacker's domain.
 * `assertTrustedOrigin` therefore refuses to run the OAuth flow in production
 * unless one of the two trusted sources above is present.
 */
export function resolveOrigin(req: Request): string {
  const trusted = configuredOrigin();
  if (trusted) return trusted;

  const proto = firstHeaderValue(req.headers.get("x-forwarded-proto"));
  const host = firstHeaderValue(req.headers.get("x-forwarded-host"));
  if (proto && host) return `${proto}://${host}`;

  return new URL(req.url).origin;
}

/**
 * Fail closed when a deployed environment has not been told its own address.
 * Returns null when the origin is safe to use, or an operator-facing reason.
 */
export function assertTrustedOrigin(): string | null {
  if (env.NODE_ENV === "production" && !configuredOrigin()) {
    return "Neither APP_ORIGIN nor VERCEL_PROJECT_PRODUCTION_URL is set for this deployment.";
  }
  return null;
}

/** An origin from configuration or the platform - never from the request. Safe
 * for links that leave the server (OAuth, email); null when neither is set. */
export function configuredOrigin(): string | null {
  if (env.APP_ORIGIN) return stripTrailingSlash(env.APP_ORIGIN);

  // Vercel supplies the domain without a scheme; it is always HTTPS.
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain) return `https://${stripTrailingSlash(vercelDomain)}`;

  return null;
}

/** A forwarded header may be a comma-separated chain; the first hop is ours. */
function firstHeaderValue(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.split(",")[0]?.trim();
  return value ? value : null;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
