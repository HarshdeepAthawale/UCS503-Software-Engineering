import type { SlaPledge } from "@prisma/client";

/**
 * Responsiveness & SLA math (T-14 / T-15; docs/PRD M6).
 *
 * TTA (time-to-acknowledgement) = the interval between a student applying and the
 * poster's FIRST action on that application. The median TTA across a poster's
 * applications drives a public responsiveness badge, so students can judge a
 * poster before spending one of their scarce application slots.
 */

/** SLA pledge → acknowledgement window, in hours. */
export const SLA_HOURS: Record<SlaPledge, number> = {
  H24: 24,
  H48: 48,
  WEEK: 168,
};

export type ResponsivenessBadge =
  | "HIGHLY_RESPONSIVE"
  | "RESPONSIVE"
  | "SLOW"
  | "UNRESPONSIVE"
  | "NEW";

/** Median of a list of millisecond durations, or null when empty. */
export function medianMs(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) return null;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

/** Median TTA in whole hours (rounded), or null when there is no acknowledged data. */
export function medianTtaHours(durationsMs: number[]): number | null {
  const m = medianMs(durationsMs);
  return m === null ? null : Math.round(m / 3_600_000);
}

/**
 * Badge from a median TTA. Thresholds are anchored to the PRD target (median TTA
 * ≤ 48h). A poster with too few acknowledged applications to be meaningful shows
 * NEW rather than a flattering or punishing verdict on one data point.
 */
export function badgeFromMedian(
  medianHours: number | null,
  sampleSize: number,
): ResponsivenessBadge {
  if (medianHours === null || sampleSize < 3) return "NEW";
  if (medianHours <= 24) return "HIGHLY_RESPONSIVE";
  if (medianHours <= 48) return "RESPONSIVE";
  if (medianHours <= 168) return "SLOW";
  return "UNRESPONSIVE";
}
