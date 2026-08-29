import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";
import type {
  SkillCreateInput,
  SkillUpdateInput,
  UserSkillAddInput,
  UserSkillsReplaceInput,
} from "@/lib/validation/schemas";

/**
 * Skill taxonomy + user-skill assignment (docs/PRD M2, tracker T-07).
 *
 * The taxonomy is admin-curated - skills are NOT free text. Admin mutations are
 * `skill_taxonomy:manage` (ADMIN-only in the matrix) and audited. Skills are
 * soft-deleted (`deletedAt`) so user_skills history and analytics stay intact.
 *
 * Assignment to a profile is ownership-scoped (`profile:update` + owner check in
 * the route) and goes through a strict allow-list DTO, so a client can never
 * attach a skill outside the taxonomy or set `proficiency` to an unknown value.
 */

// ── Taxonomy reads ───────────────────────────────────────────────────────────

/** The public taxonomy (any authenticated role, `skill_taxonomy:read`). */
export async function listSkills() {
  return prisma.skill.findMany({
    where: { deletedAt: null },
    orderBy: [{ domain: "asc" }, { name: "asc" }],
    select: { id: true, name: true, domain: true },
  });
}

/** Admin console view - includes soft-deleted rows so restores are visible. */
export async function listAllSkills() {
  return prisma.skill.findMany({
    orderBy: [{ deletedAt: "asc" }, { domain: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      domain: true,
      createdAt: true,
      deletedAt: true,
    },
  });
}

// ── Taxonomy administration (ADMIN only, audited) ────────────────────────────

export async function createSkill(admin: Principal, input: SkillCreateInput) {
  try {
    const skill = await prisma.skill.create({
      data: { name: input.name, domain: input.domain },
      select: { id: true, name: true, domain: true },
    });
    await audit({
      action: "skill.created",
      actorId: admin.userId,
      target: skill.id,
      metadata: { name: skill.name, domain: skill.domain },
    });
    return skill;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("A skill with this name already exists.");
    }
    throw e;
  }
}

export async function updateSkill(admin: Principal, id: string, input: SkillUpdateInput) {
  const existing = await prisma.skill.findUnique({
    where: { id },
    select: { deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw Errors.notFound();

  try {
    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: input.name,
        domain: input.domain,
      },
      select: { id: true, name: true, domain: true },
    });
    await audit({
      action: "skill.updated",
      actorId: admin.userId,
      target: id,
      metadata: { name: skill.name, domain: skill.domain },
    });
    return skill;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("A skill with this name already exists.");
    }
    throw e;
  }
}

/** Soft delete - keeps user_skills rows and analytics intact (Rules.md §6). */
export async function softDeleteSkill(admin: Principal, id: string) {
  const existing = await prisma.skill.findUnique({
    where: { id },
    select: { name: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw Errors.notFound();

  await prisma.skill.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await audit({
    action: "skill.deleted",
    actorId: admin.userId,
    target: id,
    metadata: { name: existing.name },
  });
  return { id, deleted: true };
}

// ── Own profile skill assignment (ownership-scoped) ──────────────────────────

/**
 * Resolve a typed skill name to a taxonomy skill id, creating the skill if it is
 * new (default domain "General"). Matching is case-insensitive so "Python" and
 * "python" collapse to one row. A member typing a skill thus grows the taxonomy
 * organically — a deliberate relaxation of admin-only curation (see D-26); the
 * `UserSkill → Skill` link, and therefore matching / faceted search, is kept.
 */
async function resolveSkillIdByName(principal: Principal, rawName: string): Promise<string> {
  const name = rawName.trim();
  const existing = await prisma.skill.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.skill.create({
      data: { name, domain: "General" },
      select: { id: true },
    });
    await audit({
      action: "skill.created",
      actorId: principal.userId,
      target: created.id,
      metadata: { name, domain: "General", source: "profile" },
    });
    return created.id;
  } catch (e) {
    // Name already exists (unique is case-sensitive & spans soft-deleted rows):
    // reuse it, un-deleting a previously removed skill of the same name.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const any = await prisma.skill.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true, deletedAt: true },
      });
      if (any) {
        if (any.deletedAt) {
          await prisma.skill.update({ where: { id: any.id }, data: { deletedAt: null } });
        }
        return any.id;
      }
    }
    throw e;
  }
}

/**
 * Replace the caller's whole skill set (profile editor). Skills arrive by NAME;
 * each is resolved to a taxonomy row (created if new). Names are de-duplicated
 * case-insensitively (last proficiency wins) so the composite PK is never
 * violated. The swap runs in one transaction so the set is never half-written.
 */
export async function replaceOwnSkills(principal: Principal, input: UserSkillsReplaceInput) {
  // De-dupe by normalised name, last-wins on proficiency.
  const byName = new Map<string, { name: string; proficiency: (typeof input.skills)[number]["proficiency"] }>();
  for (const s of input.skills) {
    const key = s.name.trim().toLowerCase();
    if (key) byName.set(key, { name: s.name.trim(), proficiency: s.proficiency });
  }
  const unique = [...byName.values()];

  const resolved = [] as { skillId: string; proficiency: (typeof unique)[number]["proficiency"] }[];
  for (const s of unique) {
    resolved.push({ skillId: await resolveSkillIdByName(principal, s.name), proficiency: s.proficiency });
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSkill.deleteMany({ where: { userId: principal.userId } });
    if (resolved.length > 0) {
      await tx.userSkill.createMany({
        data: resolved.map((s) => ({
          userId: principal.userId,
          skillId: s.skillId,
          proficiency: s.proficiency,
        })),
      });
    }
  });

  await audit({
    action: "profile.skills_replaced",
    actorId: principal.userId,
    metadata: { count: resolved.length },
  });

  return {
    userId: principal.userId,
    skills: unique.map((s) => ({ name: s.name, proficiency: s.proficiency })),
  };
}

/** Add or upsert a single skill on the caller's profile (TechSpec §5.3). */
export async function addOwnSkill(principal: Principal, input: UserSkillAddInput) {
  const skill = await prisma.skill.findFirst({
    where: { id: input.skillId, deletedAt: null },
    select: { id: true },
  });
  if (!skill) throw Errors.validation("Skill is not in the taxonomy.", "skillId");

  await prisma.userSkill.upsert({
    where: { userId_skillId: { userId: principal.userId, skillId: input.skillId } },
    create: {
      userId: principal.userId,
      skillId: input.skillId,
      proficiency: input.proficiency,
    },
    update: { proficiency: input.proficiency },
  });
  await audit({
    action: "profile.skills_replaced",
    actorId: principal.userId,
    target: input.skillId,
    metadata: { count: 1 },
  });
  return { skillId: input.skillId, proficiency: input.proficiency };
}

/** Remove a single skill from the caller's profile (idempotent). */
export async function removeOwnSkill(principal: Principal, skillId: string) {
  await prisma.userSkill.deleteMany({
    where: { userId: principal.userId, skillId },
  });
  await audit({
    action: "profile.skills_replaced",
    actorId: principal.userId,
    target: skillId,
    metadata: { count: 0 },
  });
  return { removed: true };
}
