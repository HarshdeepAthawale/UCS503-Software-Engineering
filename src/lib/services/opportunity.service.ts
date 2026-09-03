import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import { notify } from "./notification.service";
import { DEADLINE_TIERS, DEADLINE_TIER_ORDER, type DeadlineTier } from "@/lib/domain/deadline-reminder";
import type { Principal } from "@/lib/iam/policy";
import type {
  OpportunityCreateInput,
  OpportunityUpdateInput,
} from "@/lib/validation/schemas";

/**
 * Opportunity service (T-09; docs/PRD M3, TechSpec §5.4).
 *
 * Postings are structured and SLA-pledged; skills come ONLY from the admin
 * taxonomy (never free text). Poster identity and `seatsFilled`/`status` are
 * never client-supplied - they are set here from the principal and invariants.
 * Edits past `EXPIRED` are refused (TechSpec §5.4).
 */

const OPP_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  domain: true,
  duration: true,
  stipend: true,
  seatCount: true,
  seatsFilled: true,
  deadline: true,
  slaPledge: true,
  status: true,
  eligibleBranches: true,
  minCgpa: true,
  maxBacklogs: true,
  createdAt: true,
  poster: { select: { id: true, name: true, role: true } },
  opportunitySkills: {
    include: { skill: { select: { id: true, name: true, domain: true } } },
  },
} as const;

type OppRow = {
  poster: { id: string; name: string; role: string };
  opportunitySkills: {
    skill: { id: string; name: string; domain: string };
    requirement: string;
  }[];
} & Record<string, unknown>;

function toDto(row: OppRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    domain: row.domain,
    duration: row.duration,
    stipend: row.stipend,
    seatCount: row.seatCount,
    seatsFilled: row.seatsFilled,
    deadline: row.deadline,
    slaPledge: row.slaPledge,
    status: row.status,
    eligibleBranches: row.eligibleBranches,
    minCgpa: row.minCgpa === null ? null : Number(row.minCgpa),
    maxBacklogs: row.maxBacklogs,
    createdAt: row.createdAt,
    poster: row.poster,
    skills: row.opportunitySkills.map((os) => ({
      id: os.skill.id,
      name: os.skill.name,
      domain: os.skill.domain,
      requirement: os.requirement,
    })),
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createOpportunity(principal: Principal, input: OpportunityCreateInput) {
  // Validate every skillId against the LIVE taxonomy before any write.
  const skillIds = [...new Set((input.skills ?? []).map((s) => s.skillId))];
  const validSkills = skillIds.length
    ? await prisma.skill.findMany({
        where: { id: { in: skillIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  if (validSkills.length !== skillIds.length) {
    throw Errors.validation("One or more skills are not in the taxonomy.", "skills");
  }

  const opp = await prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        posterId: principal.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        domain: input.domain,
        duration: input.duration ?? null,
        stipend: input.stipend ?? false,
        seatCount: input.seatCount ?? 1,
        deadline: input.deadline,
        slaPledge: input.slaPledge,
        eligibleBranches: input.eligibleBranches ?? [],
        minCgpa: input.minCgpa ?? null,
        maxBacklogs: input.maxBacklogs ?? null,
        opportunitySkills: input.skills?.length
          ? {
              create: input.skills.map((s) => ({
                skillId: s.skillId,
                requirement: s.requirement,
              })),
            }
          : undefined,
      },
      include: { opportunitySkills: { include: { skill: true } } },
    });
    return created;
  });

  await audit({
    action: "opportunity.created",
    actorId: principal.userId,
    target: opp.id,
    metadata: { type: input.type, slaPledge: input.slaPledge },
  });
  return toDto(opp as unknown as OppRow);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * User-selectable sort orders (T-39, M4). Each is keyset-paginated on its own
 * column plus `id` as a stable tiebreaker, so pages never drift or repeat. The
 * `cmp` operator matches the sort direction (DESC → `<`, ASC → `>`), and `cmp`
 * is a fixed config literal — never user input — so `Prisma.raw` on it is safe.
 */
export type OpportunitySort = "recent" | "deadline" | "seats";
export const DEFAULT_SORT: OpportunitySort = "recent";

const SORTS: Record<
  OpportunitySort,
  {
    keyExpr: Prisma.Sql; // the primary sort column/expression
    orderBy: Prisma.Sql; // full ORDER BY (primary + id tiebreaker)
    cmp: "<" | ">"; // keyset comparison operator for the next page
    valueSql: (raw: string) => Prisma.Sql | null; // typed bound literal from a cursor token
    encode: (v: unknown) => string; // a row's sort value → cursor token
  }
> = {
  recent: {
    keyExpr: Prisma.sql`o.created_at`,
    orderBy: Prisma.sql`o.created_at DESC, o.id DESC`,
    cmp: "<",
    valueSql: (raw) => {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : Prisma.sql`${d}`;
    },
    encode: (v) => (v as Date).toISOString(),
  },
  deadline: {
    keyExpr: Prisma.sql`o.deadline`,
    orderBy: Prisma.sql`o.deadline ASC, o.id ASC`,
    cmp: ">",
    valueSql: (raw) => {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : Prisma.sql`${d}`;
    },
    encode: (v) => (v as Date).toISOString(),
  },
  seats: {
    keyExpr: Prisma.sql`(o.seat_count - o.seats_filled)`,
    orderBy: Prisma.sql`(o.seat_count - o.seats_filled) DESC, o.id DESC`,
    cmp: "<",
    valueSql: (raw) => {
      const n = Number.parseInt(raw, 10);
      return Number.isNaN(n) ? null : Prisma.sql`${n}::int`;
    },
    encode: (v) => String(v),
  },
};

/** Opaque keyset cursor `<sort>|<value>|<id>`. Carries the sort so a cursor from
 *  one ordering is ignored if the sort changes. Malformed cursors are ignored. */
function encodeCursor(sort: OpportunitySort, sortVal: unknown, id: string): string {
  return Buffer.from(`${sort}|${SORTS[sort].encode(sortVal)}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string): { sort: OpportunitySort; valueSql: Prisma.Sql; id: string } | null {
  try {
    const [sort, value, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!sort || value === undefined || !id) return null;
    if (!(sort in SORTS)) return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const valueSql = SORTS[sort as OpportunitySort].valueSql(value);
    if (!valueSql) return null;
    return { sort: sort as OpportunitySort, valueSql, id };
  } catch {
    return null;
  }
}

/**
 * Faceted discovery (T-11; docs/ImplementationPlan §3, M4).
 *
 * Full-text keyword search (`q`) runs against the GIN tsvector index via
 * `websearch_to_tsquery`; facets narrow by type/domain/stipend/skill; `sort`
 * chooses the ordering. Expired & soft-deleted rows are excluded by default.
 * Keyset-paginated on the active sort column + id.
 *
 * SAFETY: every user value is a BOUND parameter in a `Prisma.sql` template - no
 * string interpolation ever reaches the SQL text (codeguard-0-input-validation-injection).
 */
export async function listOpportunities(opts: {
  q?: string;
  type?: string;
  domain?: string;
  stipend?: string;
  skillId?: string;
  sort?: string;
  includeExpired?: boolean;
  /** Poster dashboard scope ("my postings"): every status of THIS poster's
   *  own opportunities, expired/closed included - never a filter a viewer of
   *  someone else's postings can trigger. */
  posterId?: string;
  cursor?: string;
  limit?: number;
}) {
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const sort: OpportunitySort =
    opts.sort && opts.sort in SORTS ? (opts.sort as OpportunitySort) : DEFAULT_SORT;
  const cfg = SORTS[sort];

  const conds: Prisma.Sql[] = [Prisma.sql`o.deleted_at IS NULL`];
  // A poster viewing their own dashboard sees every status, including
  // EXPIRED/CLOSED - the whole point is a complete record of what they've
  // posted, not just what's currently live.
  if (opts.posterId) {
    conds.push(Prisma.sql`o.poster_id = ${opts.posterId}::uuid`);
  } else if (!opts.includeExpired) {
    conds.push(Prisma.sql`o.status <> 'EXPIRED'::"OppStatus"`);
  }
  if (opts.type) conds.push(Prisma.sql`o.type = ${opts.type}::"OppType"`);
  if (opts.domain) conds.push(Prisma.sql`o.domain ILIKE ${"%" + opts.domain + "%"}`);
  if (opts.stipend === "true") conds.push(Prisma.sql`o.stipend = true`);
  if (opts.stipend === "false") conds.push(Prisma.sql`o.stipend = false`);
  if (opts.skillId) {
    conds.push(
      Prisma.sql`EXISTS (SELECT 1 FROM opportunity_skills os WHERE os.opportunity_id = o.id AND os.skill_id = ${opts.skillId}::uuid)`,
    );
  }
  if (opts.q) {
    conds.push(
      Prisma.sql`to_tsvector('english', coalesce(o.title, '') || ' ' || coalesce(o.description, '')) @@ websearch_to_tsquery('english', ${opts.q})`,
    );
  }

  // A cursor is honoured only when it was minted for the SAME sort - otherwise
  // pagination across a re-sorted list would be inconsistent, so we reset it.
  const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;
  const cursorClause =
    decoded && decoded.sort === sort
      ? Prisma.sql`AND (${cfg.keyExpr}, o.id) ${Prisma.raw(cfg.cmp)} (${decoded.valueSql}, ${decoded.id}::uuid)`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string; sort_val: Date | number }[]>(Prisma.sql`
    SELECT o.id, ${cfg.keyExpr} AS sort_val
    FROM opportunities o
    WHERE ${Prisma.join(conds, " AND ")} ${cursorClause}
    ORDER BY ${cfg.orderBy}
    LIMIT ${take + 1}
  `);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  // Hydrate full DTOs (poster + skills) preserving the ranked order.
  const ids = page.map((r) => r.id);
  const full = ids.length
    ? await prisma.opportunity.findMany({ where: { id: { in: ids } }, select: OPP_SELECT })
    : [];
  const byId = new Map(full.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  const last = page[page.length - 1];
  return {
    opportunities: ordered.map((r) => toDto(r as unknown as OppRow)),
    nextCursor: hasMore && last ? encodeCursor(sort, last.sort_val, last.id) : null,
    sort,
  };
}

export async function getOpportunity(id: string) {
  const row = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null },
    select: OPP_SELECT,
  });
  if (!row) throw Errors.notFound();
  return toDto(row as unknown as OppRow);
}

/**
 * Resolve the poster of a live opportunity (for the route's ownership-scoped
 * authorize call). Returns null when the row doesn't exist - the route then
 * 404s with a generic envelope (no existence leak).
 */
export async function getOpportunityPosterId(id: string): Promise<string | null> {
  const row = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null },
    select: { posterId: true },
  });
  return row?.posterId ?? null;
}

// ── Update (owner-scoped; route resolves the owner) ──────────────────────────

export async function updateOpportunity(
  principal: Principal,
  id: string,
  input: OpportunityUpdateInput,
) {
  const existing = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, posterId: true, status: true },
  });
  if (!existing) throw Errors.notFound();
  if (existing.status === "EXPIRED" || existing.status === "CLOSED") {
    throw Errors.conflict("This posting is no longer editable.");
  }

  const skillIds = [...new Set((input.skills ?? []).map((s) => s.skillId))];
  if (skillIds.length) {
    const valid = await prisma.skill.findMany({
      where: { id: { in: skillIds }, deletedAt: null },
      select: { id: true },
    });
    if (valid.length !== skillIds.length) {
      throw Errors.validation("One or more skills are not in the taxonomy.", "skills");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.update({
      where: { id },
      data: {
        // `type` is fixed at create (not editable) - deliberately omitted.
        title: input.title,
        description: input.description,
        domain: input.domain,
        duration: input.duration === undefined ? undefined : input.duration,
        stipend: input.stipend,
        seatCount: input.seatCount,
        deadline: input.deadline,
        slaPledge: input.slaPledge,
        eligibleBranches: input.eligibleBranches,
        minCgpa: input.minCgpa,
        maxBacklogs: input.maxBacklogs,
      },
      include: { opportunitySkills: { include: { skill: true } } },
    });
    if (input.skills !== undefined) {
      await tx.opportunitySkill.deleteMany({ where: { opportunityId: id } });
      if (input.skills.length) {
        await tx.opportunitySkill.createMany({
          data: input.skills.map((s) => ({
            opportunityId: id,
            skillId: s.skillId,
            requirement: s.requirement,
          })),
        });
      }
    }
    return opp;
  });

  await audit({
    action: "opportunity.updated",
    actorId: principal.userId,
    target: id,
    metadata: { fields: Object.keys(input) },
  });
  return toDto(updated as unknown as OppRow);
}

/** Close the posting (owner action, T-09). Soft state; analytics preserved. */
export async function closeOpportunity(principal: Principal, id: string) {
  const existing = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) throw Errors.notFound();
  if (existing.status === "CLOSED") throw Errors.conflict("Already closed.");
  if (existing.status === "EXPIRED") throw Errors.conflict("This posting is expired.");

  const updated = await prisma.opportunity.update({
    where: { id },
    data: { status: "CLOSED" },
    select: { id: true, status: true },
  });
  await audit({
    action: "opportunity.closed",
    actorId: principal.userId,
    target: id,
  });
  return updated;
}

// ── Expiry (T-10 job entry point) ────────────────────────────────────────────

/**
 * Flip every past-deadline LIVE/AT_RISK/DRAFT posting to EXPIRED. Idempotent;
 * returns the count flipped. Called by the periodic expiry job.
 */
export async function expirePastDeadline(): Promise<number> {
  const result = await prisma.opportunity.updateMany({
    where: {
      status: { in: ["LIVE", "AT_RISK", "DRAFT"] },
      deadline: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  if (result.count > 0) {
    await audit({
      action: "opportunity.expired",
      metadata: { count: result.count },
    });
  }
  return result.count;
}

// ── SLA breach sweep (T-15) ──────────────────────────────────────────────────

/**
 * Flip a LIVE posting to AT_RISK when it holds any application that is still
 * unacknowledged (APPLIED, no first transition) past the posting's own SLA
 * window (H24 → 24h, H48 → 48h, WEEK → 7d, measured from applied_at).
 *
 * Idempotent (only LIVE → AT_RISK). Returns the affected opportunity ids so the
 * caller can nudge each poster (T-17 notifications wire in here). Pure set-based
 * SQL; the SLA interval is chosen by the row's own pledge, no user input.
 */
export async function sweepSlaBreaches(): Promise<{ atRisk: string[] }> {
  const rows = await prisma.$queryRaw<{ id: string; poster_id: string }[]>(Prisma.sql`
    UPDATE opportunities o
    SET status = 'AT_RISK'::"OppStatus", updated_at = now()
    WHERE o.status = 'LIVE'::"OppStatus"
      AND o.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM applications a
        WHERE a.opportunity_id = o.id
          AND a.deleted_at IS NULL
          AND a.status = 'APPLIED'::"AppState"
          AND a.first_transition_at IS NULL
          AND a.applied_at < now() - (
            CASE o.sla_pledge
              WHEN 'H24'::"SlaPledge"  THEN interval '24 hours'
              WHEN 'H48'::"SlaPledge"  THEN interval '48 hours'
              WHEN 'WEEK'::"SlaPledge" THEN interval '7 days'
            END
          )
      )
    RETURNING o.id, o.poster_id
  `);

  if (rows.length > 0) {
    await audit({
      action: "opportunity.at_risk",
      metadata: { count: rows.length },
    });
    // Nudge each poster whose posting just went AT_RISK (T-15 → T-17).
    for (const r of rows) {
      await notify(r.poster_id, "opportunity.at_risk", { opportunityId: r.id });
    }
  }
  return { atRisk: rows.map((r) => r.id) };
}

// ── Deadline reminders (T-35; docs/PRD M8) ───────────────────────────────────

/**
 * Insert a `opportunity.deadline_reminder` notification for the poster of every
 * still-open posting whose deadline falls in the given tier's window, skipping
 * any poster who has already been reminded for that (opportunity, tier).
 *
 * The whole operation is ONE set-based `INSERT … SELECT … WHERE NOT EXISTS`, so
 * the dedup is race-safe against concurrent cron ticks (the DB is the arbiter,
 * per D-11) — no read-then-write window. The tier bounds are the shared
 * `DEADLINE_TIERS` constants, passed as bound parameters (never interpolated).
 * Reminders target the POSTER: the deadline is the apply-by date, so it prompts
 * them to review pending applicants and fill seats before the window closes.
 */
async function insertDeadlineReminders(tier: DeadlineTier): Promise<number> {
  const { lowerH, upperH } = DEADLINE_TIERS[tier];
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO notifications (id, user_id, type, payload, created_at)
    SELECT gen_random_uuid(), o.poster_id, 'opportunity.deadline_reminder',
           jsonb_build_object('opportunityId', o.id::text, 'tier', ${tier}::text, 'deadline', o.deadline),
           now()
    FROM opportunities o
    WHERE o.deleted_at IS NULL
      AND o.status IN ('LIVE'::"OppStatus", 'AT_RISK'::"OppStatus")
      AND o.deadline >  now() + make_interval(hours => ${lowerH}::int)
      AND o.deadline <= now() + make_interval(hours => ${upperH}::int)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = o.poster_id
          AND n.type = 'opportunity.deadline_reminder'
          AND n.payload->>'opportunityId' = o.id::text
          AND n.payload->>'tier' = ${tier}::text
      )
    RETURNING id
  `);
  return rows.length;
}

/**
 * Deadline-reminder sweep (T-35). Fires the T−72h and T−24h reminders for every
 * open posting entering each window. Idempotent — a tier reminder is sent at
 * most once per posting (enforced by the NOT EXISTS above) — so it is safe to
 * run on any schedule. Guarded upstream by CRON_SECRET.
 */
export async function remindUpcomingDeadlines(): Promise<Record<DeadlineTier, number>> {
  const counts = {} as Record<DeadlineTier, number>;
  let total = 0;
  for (const tier of DEADLINE_TIER_ORDER) {
    const n = await insertDeadlineReminders(tier);
    counts[tier] = n;
    total += n;
  }
  if (total > 0) {
    await audit({ action: "opportunity.deadline_reminder", metadata: counts });
  }
  return counts;
}
