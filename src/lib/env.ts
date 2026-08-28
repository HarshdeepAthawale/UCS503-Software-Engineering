import { z } from "zod";

/**
 * Validated, typed environment. Fail fast at boot if a required secret is
 * missing or too weak, rather than at first request (codeguard-1-hardcoded-credentials:
 * secrets come only from the environment, never from source).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  // Signing secrets must be long enough to resist brute force. 32 bytes minimum.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),

  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  ALLOWED_EMAIL_DOMAIN: z.string().default("thapar.edu"),
  APPLICATION_BUDGET: z.coerce.number().int().positive().default(10),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  // Shared secret for scheduled-job endpoints (expiry, SLA nudge). When unset,
  // those endpoints refuse to run — a cron trigger is never left open.
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be >= 16 chars").optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ALLOW_INSECURE_COOKIES: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

// Cross-field invariant: the two signing secrets must differ, or one token type
// could be forged with the other's key.
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Do not print secret values; only the field names that failed.
  const issues = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}
if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
}
if (parsed.data.NODE_ENV === "production" && parsed.data.ALLOW_INSECURE_COOKIES) {
  throw new Error("ALLOW_INSECURE_COOKIES must be false in production");
}

export const env = parsed.data;
export type Env = typeof env;
