import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import { skillFit } from "@/lib/domain/matching";
import { notify } from "./notification.service";
import type { Principal } from "@/lib/iam/policy";
import type {
  TeamCreateInput,
  TeamUpdateInput,
  TeamJoinRequestInput,
  TeamRequestDecisionInput,
} from "@/lib/validation/schemas";

/**
 * Team formation service (T-22; docs/PRD S6).
 *
 * Peer-driven: any STUDENT may lead a team - distinct from the faculty/alumni
 * -gated Opportunity pipeline. A role's `slotsFilled` is race-safe the same
 * way an opportunity's seat allocation is: a conditional UPDATE that only
 * succeeds while a slot remains (see application.service.ts transitionApplication).
 *
 * The Jaccard "complementarity" scoring the spec describes shipped as a
 * fast-follow after the core request/accept/lock flow was proven: each role
 * carries an explainable `skillFit` (matched/missing tags, never a bare
 * score - see domain/matching.ts) when the viewer supplies their own claimed
 * skills, so a prospective joiner sees at a glance which roles fit them.
 */

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

function isSerializationFailure(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2034" || e.code === "40001")
  );
}

const TEAM_SELECT = {
  id: true,
  name: true,
  hackathon: true,
  description: true,
  eventDate: true,
  status: true,
  createdAt: true,
  lead: { select: { id: true, name: true } },
  roles: {
    select: {
      id: true,
      label: true,
      slotCount: true,
      slotsFilled: true,
      skills: { select: { skill: { select: { id: true, name: true, domain: true } } } },
    },
  },
  members: {
    select: {
      userId: true,
      roleId: true,
      joinedAt: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof TEAM_SELECT }>;

interface ViewerContext {
  userId: string;
  skillIds: readonly string[];
  /** This viewer's own request per role (teamRoleId -> request), across every team. */
  requestsByRole: ReadonlyMap<string, { id: string; status: string }>;
}

/**
 * `skillFit` is only meaningful for a genuine PROSPECTIVE joiner - the lead
 * already knows the role they wrote, and an existing member has already
 * settled into a different one, so both are excluded even though either is a
 * STUDENT. `myRequest` is narrower still: absent (not zeroed) for the lead,
 * since a lead has no request of their own to track; present (possibly null)
 * for anyone else, including an existing member reviewing their own history.
 */
function toDto(row: TeamRow, viewer?: ViewerContext) {
  const isLead = viewer?.userId === row.lead.id;
  const isMember = !!viewer && row.members.some((m) => m.userId === viewer.userId);
  const showFit = !!viewer && !isLead && !isMember;
  const showMyRequest = !!viewer && !isLead;

  return {
    id: row.id,
    name: row.name,
    hackathon: row.hackathon,
    description: row.description,
    eventDate: row.eventDate,
    status: row.status,
    createdAt: row.createdAt,
    lead: row.lead,
    roles: row.roles.map((r) => {
      const roleSkillIds = r.skills.map((s) => s.skill.id);
      return {
        id: r.id,
        label: r.label,
        slotCount: r.slotCount,
        slotsFilled: r.slotsFilled,
        skills: r.skills.map((s) => s.skill),
        skillFit: showFit ? skillFit(viewer!.skillIds, roleSkillIds) : undefined,
        myRequest: showMyRequest ? (viewer!.requestsByRole.get(r.id) ?? null) : undefined,
      };
    }),
    members: row.members.map((m) => ({
      userId: m.userId,
      roleId: m.roleId,
      joinedAt: m.joinedAt,
      name: m.user.name,
    })),
  };
}

async function claimedSkillIds(userId: string): Promise<string[]> {
  const rows = await prisma.userSkill.findMany({ where: { userId }, select: { skillId: true } });
  return rows.map((r) => r.skillId);
}

async function myRequestsByRole(userId: string): Promise<Map<string, { id: string; status: string }>> {
  const rows = await prisma.teamJoinRequest.findMany({
    where: { studentId: userId },
    select: { id: true, status: true, teamRoleId: true },
  });
  return new Map(rows.map((r) => [r.teamRoleId, { id: r.id, status: r.status }]));
}

async function buildViewer(userId?: string): Promise<ViewerContext | undefined> {
  if (!userId) return undefined;
  const [skillIds, requestsByRole] = await Promise.all([claimedSkillIds(userId), myRequestsByRole(userId)]);
  return { userId, skillIds, requestsByRole };
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createTeam(principal: Principal, input: TeamCreateInput) {
  const skillIds = [...new Set(input.roles.flatMap((r) => r.skillIds))];
  const validSkills = skillIds.length
    ? await prisma.skill.findMany({ where: { id: { in: skillIds }, deletedAt: null }, select: { id: true } })
    : [];
  if (validSkills.length !== skillIds.length) {
    throw Errors.validation("One or more skills are not in the taxonomy.", "roles");
  }

  const team = await prisma.team.create({
    data: {
      leadId: principal.userId,
      name: input.name,
      hackathon: input.hackathon,
      description: input.description ?? null,
      eventDate: input.eventDate ?? null,
      roles: {
        create: input.roles.map((r) => ({
          label: r.label,
          slotCount: r.slotCount,
          skills: r.skillIds.length ? { create: r.skillIds.map((skillId) => ({ skillId })) } : undefined,
        })),
      },
    },
    select: TEAM_SELECT,
  });

  await audit({ action: "team.created", actorId: principal.userId, target: team.id });
  return toDto(team);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Opaque keyset cursor `<createdAt-iso>|<id>`, same shape as opportunity.service.ts's. */
function encodeTeamCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}
function decodeTeamCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function listTeams(opts: {
  hackathon?: string;
  status?: string;
  /** "My teams" scope: led, joined, or requested (any status) by this user. */
  mineUserId?: string;
  /** A STUDENT browsing for a slot - enables the per-role skillFit/myRequest hints. */
  viewerUserId?: string;
  cursor?: string;
  limit?: number;
}) {
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const conds: Prisma.TeamWhereInput[] = [{ deletedAt: null }];
  if (opts.mineUserId) {
    // Led, joined, OR requested (any status) - mirrors /applications tracking
    // a student's own applications regardless of outcome, not just accepted
    // ones. Otherwise a rejected/pending request is invisible everywhere.
    conds.push({
      OR: [
        { leadId: opts.mineUserId },
        { members: { some: { userId: opts.mineUserId } } },
        { roles: { some: { requests: { some: { studentId: opts.mineUserId } } } } },
      ],
    });
  } else {
    conds.push({
      status: opts.status && ["FORMING", "LOCKED", "CLOSED"].includes(opts.status)
        ? (opts.status as "FORMING" | "LOCKED" | "CLOSED")
        : "FORMING",
    });
  }
  if (opts.hackathon) conds.push({ hackathon: { contains: opts.hackathon, mode: "insensitive" } });

  // Keyset pagination (createdAt desc + id tiebreaker), same idiom as
  // opportunity.service.ts's listOpportunities - a flat `take` with no cursor
  // silently hides everything past the cap once team volume grows.
  const decoded = opts.cursor ? decodeTeamCursor(opts.cursor) : null;
  if (decoded) {
    conds.push({
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    });
  }

  const [rows, viewer] = await Promise.all([
    prisma.team.findMany({
      where: { AND: conds },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: TEAM_SELECT,
    }),
    buildViewer(opts.viewerUserId),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeTeamCursor(last.createdAt, last.id) : null;

  return { teams: page.map((r) => toDto(r, viewer)), nextCursor };
}

export async function getTeam(id: string, viewerUserId?: string) {
  const [row, viewer] = await Promise.all([
    prisma.team.findFirst({ where: { id, deletedAt: null }, select: TEAM_SELECT }),
    buildViewer(viewerUserId),
  ]);
  if (!row) throw Errors.notFound();
  return toDto(row, viewer);
}

/** Resolve the lead of a live team (for the route's ownership-scoped authorize call). */
export async function getTeamLeadId(id: string): Promise<string | null> {
  const row = await prisma.team.findFirst({ where: { id, deletedAt: null }, select: { leadId: true } });
  return row?.leadId ?? null;
}

// ── Update / close (lead-scoped) ─────────────────────────────────────────────

export async function updateTeam(principal: Principal, id: string, input: TeamUpdateInput) {
  const existing = await prisma.team.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
  if (!existing) throw Errors.notFound();
  if (existing.status !== "FORMING" && (input.name !== undefined || input.description !== undefined)) {
    throw Errors.conflict("This team is no longer open for edits.");
  }

  const updated = await prisma.team.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      eventDate: input.eventDate,
      status: input.status,
    },
    select: TEAM_SELECT,
  });

  if (input.status === "CLOSED") {
    await audit({ action: "team.closed", actorId: principal.userId, target: id });
  }
  return toDto(updated);
}

/**
 * The lead's inbox for one team - every join request across every role.
 * Naturally small-scale (bounded by real team sizes, unlike the public
 * browse feed), so a flat safety cap is proportionate here rather than full
 * cursor pagination - it just must not be literally unbounded.
 */
export async function listJoinRequestsForTeam(teamId: string) {
  const requests = await prisma.teamJoinRequest.findMany({
    where: { teamRole: { teamId } },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      status: true,
      message: true,
      rejectionCode: true,
      createdAt: true,
      teamRole: { select: { id: true, label: true } },
      student: { select: { id: true, name: true } },
    },
  });
  return {
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      rejectionCode: r.rejectionCode,
      createdAt: r.createdAt,
      role: r.teamRole,
      student: r.student,
    })),
  };
}

// ── Join requests (student) ──────────────────────────────────────────────────

export async function getJoinRequestRefs(
  requestId: string,
): Promise<{ leadId: string; studentId: string; teamId: string } | null> {
  const req = await prisma.teamJoinRequest.findFirst({
    where: { id: requestId },
    select: { studentId: true, teamRole: { select: { team: { select: { id: true, leadId: true } } } } },
  });
  if (!req) return null;
  return { leadId: req.teamRole.team.leadId, studentId: req.studentId, teamId: req.teamRole.team.id };
}

export async function requestToJoin(
  principal: Principal,
  teamRoleId: string,
  input: TeamJoinRequestInput,
) {
  const role = await prisma.teamRole.findFirst({
    where: { id: teamRoleId },
    select: {
      slotCount: true,
      slotsFilled: true,
      team: { select: { id: true, status: true, leadId: true, deletedAt: true } },
    },
  });
  if (!role || role.team.deletedAt) throw Errors.notFound();
  if (role.team.leadId === principal.userId) {
    throw Errors.domainRule("You cannot request to join your own team.");
  }
  if (role.team.status !== "FORMING") {
    throw Errors.conflict("This team is no longer recruiting.");
  }
  if (role.slotsFilled >= role.slotCount) {
    throw Errors.conflict("This role is already full.");
  }
  const alreadyMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: role.team.id, userId: principal.userId } },
    select: { userId: true },
  });
  if (alreadyMember) throw Errors.conflict("You are already on this team.");

  // `@@unique([teamRoleId, studentId])` is a PLAIN unique index (unlike
  // applications' partial one, which excludes soft-deleted rows) - a student
  // gets at most one request row per role, ever. So a prior REJECTED/
  // WITHDRAWN row isn't a duplicate to reject; it's re-opened back to
  // PENDING, the same way withdrawing an application frees it to re-apply.
  const existing = await prisma.teamJoinRequest.findUnique({
    where: { teamRoleId_studentId: { teamRoleId, studentId: principal.userId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "PENDING") {
    throw Errors.conflict("You already have an open request for this role.");
  }

  let request;
  try {
    request = existing
      ? await prisma.teamJoinRequest.update({
          where: { id: existing.id },
          data: { status: "PENDING", message: input.message ?? null, rejectionCode: null },
          select: { id: true, status: true, createdAt: true },
        })
      : await prisma.teamJoinRequest.create({
          data: { teamRoleId, studentId: principal.userId, message: input.message ?? null },
          select: { id: true, status: true, createdAt: true },
        });
  } catch (e) {
    // Narrow race: two concurrent first-time requests when `existing` was
    // null for both. Whichever loses the create() gets a clean conflict
    // rather than a raw constraint-violation 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("You already have an open request for this role.");
    }
    throw e;
  }

  await audit({
    action: "team.join_requested",
    actorId: principal.userId,
    target: request.id,
    metadata: { teamRoleId },
  });
  await notify(role.team.leadId, "team.join_requested", {
    teamId: role.team.id,
    teamRoleId,
    requestId: request.id,
  });
  return request;
}

export async function withdrawJoinRequest(principal: Principal, requestId: string) {
  const req = await prisma.teamJoinRequest.findFirst({
    where: { id: requestId },
    select: { status: true, studentId: true },
  });
  if (!req) throw Errors.notFound();
  if (req.studentId !== principal.userId) throw Errors.forbidden();
  if (req.status !== "PENDING") throw Errors.conflict("This request can no longer be withdrawn.");

  const updated = await prisma.teamJoinRequest.update({
    where: { id: requestId },
    data: { status: "WITHDRAWN" },
    select: { id: true, status: true },
  });
  await audit({ action: "team.request_withdrawn", actorId: principal.userId, target: requestId });
  return updated;
}

// ── Decide (lead) ─────────────────────────────────────────────────────────────

export async function decideJoinRequest(
  principal: Principal,
  requestId: string,
  input: TeamRequestDecisionInput,
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.teamJoinRequest.findFirst({
        where: { id: requestId },
        select: {
          status: true,
          studentId: true,
          teamRoleId: true,
          teamRole: { select: { slotCount: true, team: { select: { id: true, leadId: true } } } },
        },
      });
      if (!req) throw Errors.notFound();
      if (req.status !== "PENDING") {
        throw Errors.conflict("This request has already been decided.");
      }

      if (input.status === "ACCEPTED") {
        const slot = await tx.teamRole.updateMany({
          where: { id: req.teamRoleId, slotsFilled: { lt: req.teamRole.slotCount } },
          data: { slotsFilled: { increment: 1 } },
        });
        if (slot.count === 0) throw Errors.conflict("This role is already full.");

        await tx.teamMember.create({
          data: { teamId: req.teamRole.team.id, userId: req.studentId, roleId: req.teamRoleId },
        });
      }

      const updated = await tx.teamJoinRequest.update({
        where: { id: requestId },
        data: {
          status: input.status,
          rejectionCode: input.status === "REJECTED" ? (input.rejectionCode ?? "OTHER") : null,
        },
        select: { id: true, status: true },
      });

      let locked = false;
      if (input.status === "ACCEPTED") {
        // Small, bounded set (a team holds at most 10 roles - TeamCreateSchema),
        // so checking in JS is simpler and clearer than a column-vs-column filter.
        const roles = await tx.teamRole.findMany({
          where: { teamId: req.teamRole.team.id },
          select: { slotCount: true, slotsFilled: true },
        });
        if (roles.every((r) => r.slotsFilled >= r.slotCount)) {
          await tx.team.update({ where: { id: req.teamRole.team.id }, data: { status: "LOCKED" } });
          locked = true;
        }
      }

      return { updated, studentId: req.studentId, teamId: req.teamRole.team.id, locked };
    }, SERIALIZABLE);

    await audit({
      action: "team.request_decided",
      actorId: principal.userId,
      target: requestId,
      metadata: { status: input.status },
    });
    await notify(
      result.studentId,
      input.status === "ACCEPTED" ? "team.request_accepted" : "team.request_rejected",
      { teamId: result.teamId, requestId },
    );
    if (result.locked) {
      const team = await prisma.team.findUnique({
        where: { id: result.teamId },
        select: { leadId: true, members: { select: { userId: true } } },
      });
      const recipients = new Set([team?.leadId, ...(team?.members.map((m) => m.userId) ?? [])]);
      for (const userId of recipients) {
        if (userId) await notify(userId, "team.locked", { teamId: result.teamId });
      }
    }
    return result.updated;
  } catch (e) {
    if (isSerializationFailure(e)) {
      throw Errors.conflict("Please retry - a concurrent update interfered.");
    }
    throw e;
  }
}
