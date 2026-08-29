/**
 * Deadline-reminder tiers (T-35; docs/PRD M8).
 *
 * PRD M8 promises reminders "at T−72h and T−24h". We model each as a
 * non-overlapping window measured back from the deadline, so a posting crosses
 * each threshold exactly once as its deadline approaches:
 *
 *   T72 → more than 24h but at most 72h remain
 *   T24 → at most 24h remains (and the deadline has not yet passed)
 *
 * A posting created with, say, 20h left therefore fires ONLY the T24 reminder,
 * never a redundant T72. Pure and dependency-free so the boundary rule is
 * unit-tested without a database; the set-based sweep in opportunity.service
 * reuses these same bounds as bound parameters, keeping one source of truth.
 */

export type DeadlineTier = "T72" | "T24";

/** Each tier's window in hours-before-deadline, as a half-open range (lower, upper]. */
export const DEADLINE_TIERS: Record<DeadlineTier, { lowerH: number; upperH: number }> = {
  T72: { lowerH: 24, upperH: 72 },
  T24: { lowerH: 0, upperH: 24 },
};

/** Sweep order: the farther-out tier first, so a fresh short-deadline posting
 *  still resolves to its single correct tier. */
export const DEADLINE_TIER_ORDER: DeadlineTier[] = ["T72", "T24"];

/**
 * The reminder tier a posting falls into right now, or null if none applies
 * (deadline already passed, or more than 72h away). Mirrors the SQL window
 * exactly: `now + lowerH < deadline <= now + upperH`.
 */
export function reminderTierFor(deadline: Date, now: Date): DeadlineTier | null {
  const hoursUntil = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil <= 0) return null;
  for (const tier of DEADLINE_TIER_ORDER) {
    const { lowerH, upperH } = DEADLINE_TIERS[tier];
    if (hoursUntil > lowerH && hoursUntil <= upperH) return tier;
  }
  return null;
}
