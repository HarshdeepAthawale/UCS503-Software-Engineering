import { decodeJwt } from "jose";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";

/**
 * Google OAuth 2.0 (Authorization Code flow) - "Sign in with Google".
 *
 * The ID token is fetched directly from Google's token endpoint over TLS using
 * our client secret, so it arrives on an authenticated channel. We still assert
 * the standard claims (issuer, audience, expiry, verified email) before trusting
 * it. The client secret is read only from the environment, never from source.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const VALID_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export const OAUTH_STATE_COOKIE = "nx_oauth_state";
const STATE_COOKIE_PATH = "/api/auth/google";

export function googleConfigured(): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

export function buildGoogleAuthUrl(opts: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    access_type: "online",
    prompt: "select_account",
    // Pre-filters the account chooser to the institute domain. A CONVENIENCE
    // ONLY - `hd` is client-supplied and trivially removed, so the real check
    // stays server-side in loginWithGoogle() against ALLOWED_EMAIL_DOMAIN.
    hd: env.ALLOWED_EMAIL_DOMAIN,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
  sub: string;
}

/** Exchange an authorization code for the verified Google profile. */
export async function exchangeCodeForProfile(opts: {
  code: string;
  redirectUri: string;
}): Promise<GoogleProfile> {
  if (!googleConfigured()) throw Errors.notFound();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw Errors.unauthenticated("Google rejected the sign-in. Please try again.");
  }
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw Errors.unauthenticated("Google returned no identity token.");

  let claims: Record<string, unknown>;
  try {
    claims = decodeJwt(body.id_token) as Record<string, unknown>;
  } catch {
    throw Errors.unauthenticated("Malformed Google identity token.");
  }

  const iss = String(claims.iss ?? "");
  const aud = String(claims.aud ?? "");
  const exp = Number(claims.exp ?? 0);
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";

  if (!VALID_ISSUERS.has(iss)) throw Errors.unauthenticated("Untrusted token issuer.");
  if (aud !== env.GOOGLE_CLIENT_ID) throw Errors.unauthenticated("Token audience mismatch.");
  if (!exp || exp * 1000 <= Date.now()) throw Errors.unauthenticated("Google token has expired.");
  if (!email || !sub) throw Errors.unauthenticated("Google token missing identity claims.");

  return {
    email,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
    sub,
  };
}

// ── Short-lived CSRF state cookie (SameSite=Lax so it survives Google's redirect) ─

export function buildStateCookie(state: string): string {
  return [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}`,
    `Path=${STATE_COOKIE_PATH}`,
    "Max-Age=600",
    "HttpOnly",
    env.ALLOW_INSECURE_COOKIES ? "" : "Secure",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearStateCookie(): string {
  return [
    `${OAUTH_STATE_COOKIE}=`,
    `Path=${STATE_COOKIE_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    env.ALLOW_INSECURE_COOKIES ? "" : "Secure",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}
