import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import {
  badgeFromMedian,
  medianTtaHours,
  type ResponsivenessBadge,
} from "@/lib/domain/responsiveness";
import type { AppState, OppStatus, OppType } from "@prisma/client";

/**
 * Analytics service (T-14; docs/PRD M6).
 *
 * All figures derive from the immutable ApplicationEvent log via the denormalised
 * `applied_at` / `first_transition_at` stamps, so they are trustworthy by
 * construction - a poster cannot backdate acknowledgements.
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

// ── Institute-wide analytics (T-25; docs/PRD M9) ─────────────────────────────

const APP_STATES: AppState[] = [
  "APPLIED", "RECEIVED", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN",
];
const OPP_TYPES: OppType[] = [
  "RESEARCH", "INTERNSHIP", "TA", "HACKATHON_TEAM", "MICRO_TASK", "REFERRAL",
];
const OPP_STATUSES: OppStatus[] = ["DRAFT", "LIVE", "AT_RISK", "EXPIRED", "CLOSED"];
const TREND_DAYS = 14;

export interface InstituteAnalytics {
  applications: {
    total: number;
    resolved: number;
    resolutionRate: number; // 0..1, terminal / total
    acknowledged: number;
    medianTtaHours: number | null;
  };
  seats: { total: number; filled: number; fillRate: number };
  byAppState: Record<AppState, number>;
  byOppType: Record<OppType, number>;
  byOppStatus: Record<OppStatus, number>;
  perDay: { day: string; count: number }[]; // last TREND_DAYS, gap-filled
}

/**
 * Platform-wide analytics for the admin console. The headline application
 * figures (resolution rate, median TTA) are computed set-based in SQL —
 * `percentile_cont` for the median so it scales without pulling every row —
 * over the immutable `applied_at` / `first_transition_at` stamps, so they are
 * trustworthy by construction. Distributions come from indexed `groupBy`s.
 */
export async function getInstituteAnalytics(): Promise<InstituteAnalytics> {
  const [headline, seatAgg, byState, byType, byStatus, perDayRows] = await Promise.all([
    prisma.$queryRaw<
      { total: number; resolved: number; acknowledged: number; median_tta_seconds: number | null }[]
    >(Prisma.sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status IN ('SELECTED','REJECTED','WITHDRAWN'))::int AS resolved,
        count(*) FILTER (WHERE first_transition_at IS NOT NULL)::int AS acknowledged,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM (first_transition_at - applied_at))
        ) FILTER (WHERE first_transition_at IS NOT NULL) AS median_tta_seconds
      FROM applications
      WHERE deleted_at IS NULL
    `),
    prisma.opportunity.aggregate({
      where: { deletedAt: null },
      _sum: { seatCount: true, seatsFilled: true },
    }),
    prisma.application.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.opportunity.groupBy({ by: ["type"], where: { deletedAt: null }, _count: true }),
    prisma.opportunity.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.$queryRaw<{ day: Date; n: number }[]>(Prisma.sql`
      SELECT date_trunc('day', applied_at)::date AS day, count(*)::int AS n
      FROM applications
      WHERE deleted_at IS NULL
        AND applied_at >= (current_date - make_interval(days => ${TREND_DAYS - 1}))
      GROUP BY 1
      ORDER BY 1
    `),
  ]);

  const h = headline[0] ?? { total: 0, resolved: 0, acknowledged: 0, median_tta_seconds: null };
  const seatTotal = seatAgg._sum.seatCount ?? 0;
  const seatFilled = seatAgg._sum.seatsFilled ?? 0;

  const byAppState = zeroed(APP_STATES);
  for (const r of byState) byAppState[r.status] = r._count;
  const byOppType = zeroed(OPP_TYPES);
  for (const r of byType) byOppType[r.type] = r._count;
  const byOppStatus = zeroed(OPP_STATUSES);
  for (const r of byStatus) byOppStatus[r.status] = r._count;

  return {
    applications: {
      total: h.total,
      resolved: h.resolved,
      resolutionRate: h.total === 0 ? 0 : h.resolved / h.total,
      acknowledged: h.acknowledged,
      medianTtaHours:
        h.median_tta_seconds == null ? null : Math.round(h.median_tta_seconds / 3600),
    },
    seats: {
      total: seatTotal,
      filled: seatFilled,
      fillRate: seatTotal === 0 ? 0 : seatFilled / seatTotal,
    },
    byAppState,
    byOppType,
    byOppStatus,
    perDay: fillTrend(perDayRows),
  };
}

/** A record with every key of `keys` pre-set to 0 (so absent buckets show as 0). */
function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

/** Expand sparse day rows into a dense, ascending TREND_DAYS-long series. */
function fillTrend(rows: { day: Date; n: number }[]): { day: string; count: number }[] {
  const counts = new Map(rows.map((r) => [iso(r.day), r.n]));
  const today = new Date();
  const out: { day: string; count: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = iso(d);
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
