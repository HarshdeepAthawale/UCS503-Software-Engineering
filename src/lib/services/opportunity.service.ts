import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
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
 * never client-supplied — they are set here from the principal and invariants.
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

/** Faceted list — type/domain/stipend filters; excludes expired/deleted by default. */
export async function listOpportunities(opts: {
  type?: string;
  domain?: string;
  stipend?: string;
  includeExpired?: boolean;
  cursor?: string;
  limit?: number;
}) {
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const where: Record<string, unknown> = { deletedAt: null };
  if (!opts.includeExpired) where.status = { not: "EXPIRED" };
  if (opts.type) where.type = opts.type;
  if (opts.domain) where.domain = { contains: opts.domain, mode: "insensitive" };
  if (opts.stipend === "true") where.stipend = true;
  if (opts.stipend === "false") where.stipend = false;

  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor } } : {}),
    select: OPP_SELECT,
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  return {
    opportunities: page.map((r) => toDto(r as unknown as OppRow)),
    nextCursor: hasMore && last ? last.id : null,
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
 * authorize call). Returns null when the row doesn't exist — the route then
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
        // `type` is fixed at create (not editable) — deliberately omitted.
        title: input.title,
        description: input.description,
        domain: input.domain,
        duration: input.duration === undefined ? undefined : input.duration,
        stipend: input.stipend,
        seatCount: input.seatCount,
        deadline: input.deadline,
        slaPledge: input.slaPledge,
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
