import { randomBytes, createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Refresh-token material — Node-only (uses `node:crypto`). Do NOT import this
 * module from edge code (middleware); use access-token.ts there instead.
 *
 * Refresh tokens are opaque 256-bit CSPRNG strings that act as the server-side
 * session (docs/TechSpec §6.1). Only a SHA-256 hash is stored; rotation + reuse
 * detection make theft observable (codeguard-0-session-management-and-cookies).
 */

export interface RefreshMaterial {
  raw: string; // sent to the client (cookie); never stored
  hash: string; // stored server-side
  expiresAt: Date;
}

export function issueRefreshMaterial(): RefreshMaterial {
  const raw = randomBytes(32).toString("base64url"); // 256 bits of entropy
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: hashToken(raw), expiresAt };
}

/** SHA-256 of the token — deterministic lookup key, one-way at rest. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Hash of a client fingerprint (User-Agent) for anomaly detection, non-PII. */
export function fingerprint(userAgent: string | null): string {
  return createHash("sha256")
    .update(userAgent ?? "unknown")
    .digest("hex");
}
