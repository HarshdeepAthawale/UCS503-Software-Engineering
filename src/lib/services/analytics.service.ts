import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import {
  badgeFromMedian,
  medianTtaHours,
  type ResponsivenessBadge,
} from "@/lib/domain/responsiveness";

/**
 * Analytics service (T-14; docs/PRD M6).
 *
 * All figures derive from the immutable ApplicationEvent log via the denormalised
 * `applied_at` / `first_transition_at` stamps, so they are trustworthy by
 * construction — a poster cannot backdate acknowledgements.
 */

function ttaDurations(
  rows: { appliedAt: Date; firstTransitionAt: Date | null }[],
): number[] {
  return rows
    .filter((r) => r.firstTransitionAt !== null)
    .map((r) => r.firstTransitionAt!.getTime() - r.appliedAt.getTime())
    .filter((ms) => ms >= 0);
}

export interface PosterResponsiveness {
  badge: ResponsivenessBadge;
  medianTtaHours: number | null;
  sampleSize: number;
}

/** A poster's public responsiveness across all their postings' applications. */
export async function getPosterResponsiveness(
  posterId: string,
): Promise<PosterResponsiveness> {
  const rows = await prisma.application.findMany({
    where: { deletedAt: null, opportunity: { posterId } },
    select: { appliedAt: true, firstTransitionAt: true },
  });
  const durations = ttaDurations(rows);
  const median = medianTtaHours(durations);
  return {
    badge: badgeFromMedian(median, durations.length),
    medianTtaHours: median,
    sampleSize: durations.length,
  };
}

export interface OpportunityAnalytics {
  applicants: number;
  acknowledged: number;
  acknowledgementRate: number; // 0..1
  medianTtaHours: number | null;
  posterBadge: ResponsivenessBadge;
}

/** Pipeline analytics for one opportunity (poster/admin view). */
export async function getOpportunityAnalytics(
  opportunityId: string,
): Promise<OpportunityAnalytics> {
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { posterId: true },
  });
  if (!opp) throw Errors.notFound();

  const rows = await prisma.application.findMany({
    where: { opportunityId, deletedAt: null },
    select: { appliedAt: true, firstTransitionAt: true },
  });
  const durations = ttaDurations(rows);
  const acknowledged = durations.length;
  const applicants = rows.length;
  const poster = await getPosterResponsiveness(opp.posterId);

  return {
    applicants,
    acknowledged,
    acknowledgementRate: applicants === 0 ? 0 : acknowledged / applicants,
    medianTtaHours: medianTtaHours(durations),
    posterBadge: poster.badge,
  };
}
