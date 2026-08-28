import type { NotifFreq } from "@prisma/client";
import { SLA_HOURS } from "./responsiveness";

/**
 * Notification digest cadence (T-17). Pure and dependency-free so the batching
 * rule is unit-tested without touching the database.
 *
 * True iff a user's digest window has elapsed since their last digest:
 *  • IMMEDIATE → always due; • DAILY → ≥ 24h; • WEEKLY → ≥ 7 days.
 * A first-ever digest (no `lastDigestAt`) is always due.
 */
export function isDue(
  frequency: NotifFreq,
  lastDigestAt: Date | null,
  now: Date,
): boolean {
  if (frequency === "IMMEDIATE" || lastDigestAt === null) return true;
  const elapsedH = (now.getTime() - lastDigestAt.getTime()) / 3_600_000;
  return frequency === "DAILY" ? elapsedH >= 24 : elapsedH >= SLA_HOURS.WEEK;
}
