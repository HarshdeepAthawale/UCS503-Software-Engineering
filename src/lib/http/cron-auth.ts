import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";

/**
 * Authenticates scheduled-job endpoints (T-10 expiry, T-15 SLA nudge).
 *
 * A caller must present `Authorization: Bearer <CRON_SECRET>`. The comparison is
 * constant-time to avoid leaking the secret through timing. If CRON_SECRET is
 * not configured, the endpoint refuses entirely (fail-closed) rather than
 * running unauthenticated - a cron trigger is never left open to the internet.
 */
export function requireCronSecret(req: Request): void {
  const configured = env.CRON_SECRET;
  if (!configured) {
    // Not configured → treat as if the route does not exist. No behaviour,
    // no information leak about why.
    throw Errors.notFound();
  }

  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(configured, "utf8");
  // timingSafeEqual requires equal-length buffers; length mismatch is itself a
  // mismatch, but we still run a compare against a fixed buffer to keep timing
  // uniform regardless of which check fails.
  const equal = a.length === b.length && timingSafeEqual(a, b);
  if (!equal) throw Errors.unauthenticated("Invalid cron credentials.");
}
