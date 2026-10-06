import { z } from "zod";

/**
 * Validated, typed environment. Fail fast at boot if a required secret is
 * missing or too weak, rather than at first request (codeguard-1-hardcoded-credentials:
 * secrets come only from the environment, never from source).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  // Signing secrets must be long enough to resist brute force. 32 bytes minimum.
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),

  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  ALLOWED_EMAIL_DOMAIN: z.string().default("thapar.edu"),
  APPLICATION_BUDGET: z.coerce.number().int().positive().default(10),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  // Shared secret for scheduled-job endpoints (expiry, SLA nudge). When unset,
  // those endpoints refuse to run - a cron trigger is never left open.
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be >= 16 chars").optional(),

  // Canonical public origin, e.g. "https://nexus.thapar.edu". Set this in every
  // deployed environment: the Google OAuth redirect_uri must match what is
  // registered in the Google Cloud client BYTE FOR BYTE, and deriving it from
  // the request Host header is both proxy-dependent and attacker-influenced.
  // Optional so local dev and `next build` work without it (see resolveOrigin).
  APP_ORIGIN: z
    .string()
    .url("APP_ORIGIN must be an absolute URL, e.g. https://nexus.example.edu")
    .optional(),

  // Outbound email (Brevo). Both are needed for delivery; with either unset
  // the mailer refuses to send in production rather than silently dropping the
  // message, and logs it instead in dev. EMAIL_FROM must be a sender verified
  // in the Brevo account, e.g. "Thapar Nexus <you@gmail.com>".
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Google OAuth (Sign in with Google). Optional - when either is unset the
  // Google auth routes 404 and the button is hidden. Secret lives ONLY here.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Google Calendar meeting scheduling (incremental OAuth consent for the
  // calendar.events scope). Optional - when unset, the calendar-connect and
  // meeting-scheduling routes 404 and the UI hides the option, same pattern as
  // GOOGLE_CLIENT_ID above. A stored Google refresh token is encrypted at rest
  // with this key (AES-256-GCM) - never logged, never derived from anything
  // else (codeguard-1-hardcoded-credentials). Generate with e.g.
  // `openssl rand -base64 32`.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be >= 32 chars")
    .optional(),

  // Supabase Storage for résumé PDFs (T-44, M2). The SERVICE ROLE key is
  // server-only and MUST NOT be exposed to the client - it is used solely to
  // upload to and mint short-lived signed URLs for a PRIVATE bucket. When either
  // the URL or the key is unset, résumé upload/preview is disabled (the routes
  // report it) rather than erroring obscurely. Bucket defaults to "resumes".
  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be an absolute URL, e.g. https://xyz.supabase.co")
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_RESUME_BUCKET: z.string().default("resumes"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  ALLOW_INSECURE_COOKIES: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/**
 * An environment variable that exists but is BLANK counts as unset.
 *
 * Zod applies `.default()` only when the value is `undefined`, so a variable
 * present with an empty string skips the default and then fails validation.
 * That is not hypothetical: a Vercel build failed on REFRESH_TOKEN_TTL_DAYS,
 * APPLICATION_BUDGET, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, AUTH_RATE_LIMIT_MAX,
 * AUTH_RATE_LIMIT_WINDOW_SECONDS, CRON_SECRET and ALLOW_INSECURE_COOKIES -
 * every one of which HAS a default and none of which needed to be set at all.
 * They had been created in the dashboard with blank values.
 *
 * Verified: parsing `{}` passes; parsing `{ FIELD: "" }` fails on exactly
 * those fields.
 *
 * This does not weaken anything. DATABASE_URL and the two signing secrets have
 * no defaults, so a blank value still fails - which is correct, and is the
 * build refusing to ship a misconfigured deployment.
 */
const withBlanksAsUnset = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);

// Cross-field invariant: the two signing secrets must differ, or one token type
// could be forged with the other's key.
const parsed = EnvSchema.safeParse(withBlanksAsUnset);
if (!parsed.success) {
  // Do not print secret values; only the field names that failed.
  // Field names and the reason only - never the value, which is the secret.
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")} (${i.message})`)
    .join(", ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}
if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
}
if (
  parsed.data.NODE_ENV === "production" &&
  parsed.data.ALLOW_INSECURE_COOKIES
) {
  throw new Error("ALLOW_INSECURE_COOKIES must be false in production");
}

export const env = parsed.data;
export type Env = typeof env;
