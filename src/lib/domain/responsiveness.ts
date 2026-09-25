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

/** The badge covers a rolling window, so a poster can recover from a bad term. */
export const RESPONSIVENESS_WINDOW_DAYS = 90;

/** Minimum share of due applications answered before the median alone decides. */
const FULL_CREDIT_RATE = 0.8;
/** Below this share answered, the poster is UNRESPONSIVE whatever their median. */
const MIN_RESPONSE_RATE = 0.5;

const BAND_ORDER: readonly ResponsivenessBadge[] = [
  "HIGHLY_RESPONSIVE",
  "RESPONSIVE",
  "SLOW",
  "UNRESPONSIVE",
];

export interface TtaSample {
  appliedAt: Date;
  firstTransitionAt: Date | null;
  status: string;
  slaPledge: SlaPledge;
}

export interface ResponsivenessSummary {
  badge: ResponsivenessBadge;
  /** Median TTA over acknowledged applications only. */
  medianTtaHours: number | null;
  /** acknowledged / (acknowledged + overdue); null when nothing is due yet. */
  responseRate: number | null;
  /** acknowledged + overdue - the applications the poster owed a reply on. */
  sampleSize: number;
}

/**
 * A poster's public responsiveness (PRD M6: "rolling response rate + median TTA").
 *
 * The median alone cannot see silence - an application nobody ever opened has no
 * TTA - so a poster could answer three fast, ghost fifty, and look exemplary.
 * The response rate is what makes ghosting count:
 *  • acknowledged = the poster acted on it at least once;
 *  • overdue = never acknowledged AND older than its posting's SLA window;
 *  • an application still inside its window is owed nothing yet, and one the
 *    student withdrew before any reply is left out (we cannot tell whether they
 *    left because of the silence or for their own reasons).
 * Only applications made within the rolling window count.
 */
export function summarizeResponsiveness(
  rows: TtaSample[],
  now: Date,
): ResponsivenessSummary {
  const since = now.getTime() - RESPONSIVENESS_WINDOW_DAYS * 24 * 3_600_000;
  const durations: number[] = [];
  let overdue = 0;

  for (const r of rows) {
    const applied = r.appliedAt.getTime();
    if (applied < since) continue;
    if (r.firstTransitionAt) {
      const ms = r.firstTransitionAt.getTime() - applied;
      if (ms >= 0) durations.push(ms);
      continue;
    }
    if (r.status === "WITHDRAWN") continue;
    if (now.getTime() - applied > SLA_HOURS[r.slaPledge] * 3_600_000) overdue += 1;
  }

  const sampleSize = durations.length + overdue;
  const responseRate = sampleSize === 0 ? null : durations.length / sampleSize;
  const median = medianTtaHours(durations);

  const rate = responseRate ?? 0;
  let badge: ResponsivenessBadge;
  if (sampleSize < 3) badge = "NEW";
  else if (rate < MIN_RESPONSE_RATE || median === null) badge = "UNRESPONSIVE";
  else {
    badge = badgeFromMedian(median, sampleSize);
    if (rate < FULL_CREDIT_RATE) badge = worse(badge, "SLOW");
  }

  return { badge, medianTtaHours: median, responseRate, sampleSize };
}

function worse(a: ResponsivenessBadge, b: ResponsivenessBadge): ResponsivenessBadge {
  return BAND_ORDER.indexOf(a) >= BAND_ORDER.indexOf(b) ? a : b;
}
