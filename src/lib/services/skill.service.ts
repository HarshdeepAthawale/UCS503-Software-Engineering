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
 * Replace the caller's whole skill set (profile editor). Validates every skillId
 * against the LIVE taxonomy first - a soft-deleted skill cannot be re-attached.
 * Runs in one transaction so the set is never observed half-written.
 */
export async function replaceOwnSkills(principal: Principal, input: UserSkillsReplaceInput) {
  const ids = [...new Set(input.skills.map((s) => s.skillId))];

  const valid = await prisma.skill.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  if (valid.length !== ids.length) {
    throw Errors.validation("One or more skills are not in the taxonomy.", "skills");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSkill.deleteMany({ where: { userId: principal.userId } });
    if (input.skills.length > 0) {
      await tx.userSkill.createMany({
        data: input.skills.map((s) => ({
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
    metadata: { count: input.skills.length },
  });

  return {
    userId: principal.userId,
    skills: input.skills.map((s) => ({
      skillId: s.skillId,
      proficiency: s.proficiency,
    })),
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
