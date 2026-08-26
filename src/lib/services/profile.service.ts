import { prisma } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";
import type { ProfileUpdateInput } from "@/lib/validation/schemas";

/**
 * Profile service. Field-level privacy is enforced on read: CGPA is only exposed
 * to the owner or when `cgpaPublic` is true (docs/PRD NFR-PR1). Writes go through
 * a strict allow-list DTO (schemas.ts) so `role`/`status` can never be mass-assigned.
 */

export async function getProfile(viewer: Principal, targetUserId: string) {
  const row = await prisma.profile.findFirst({
    where: { userId: targetUserId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, role: true } },
      userSkills: { include: { skill: true } },
    },
  });
  if (!row) return null;

  const isOwner = viewer.userId === targetUserId;
  const canSeeCgpa = isOwner || row.cgpaPublic || viewer.role === "ADMIN";

  return {
    userId: row.userId,
    name: row.user.name,
    role: row.user.role,
    branch: row.branch,
    year: row.year,
    bio: row.bio,
    cgpa: canSeeCgpa ? row.cgpa : null,
    cgpaPublic: row.cgpaPublic,
    skills: row.userSkills.map((us) => ({
      id: us.skill.id,
      name: us.skill.name,
      domain: us.skill.domain,
      proficiency: us.proficiency,
    })),
  };
}

/** Upserts the caller's own profile from an allow-listed DTO. */
export async function updateOwnProfile(principal: Principal, input: ProfileUpdateInput) {
  const data = {
    branch: input.branch,
    year: input.year,
    cgpa: input.cgpa,
    cgpaPublic: input.cgpaPublic,
    bio: input.bio,
  };
  const saved = await prisma.profile.upsert({
    where: { userId: principal.userId },
    create: { userId: principal.userId, ...data },
    update: data,
    select: { userId: true, branch: true, year: true, cgpaPublic: true, bio: true },
  });
  await audit({ action: "profile.updated", actorId: principal.userId });
  return saved;
}
