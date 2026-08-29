import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import {
  removeResumeObject,
  resumeStorageConfigured,
  signResumeUrl,
  uploadResumeObject,
} from "@/lib/storage/resume-storage";
import type { Principal } from "@/lib/iam/policy";
import type {
  ProfileUpdateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
} from "@/lib/validation/schemas";

/**
 * Who may see a résumé: the owner, an ADMIN, or any FACULTY / ALUMNI — the
 * institute roles that post opportunities and review candidates ("faculty and
 * employees can view"). A STUDENT may view only their own. Gates both the
 * metadata on a profile and the signed preview/download URLs.
 */
function canViewResume(viewer: Principal, ownerId: string): boolean {
  return (
    viewer.userId === ownerId ||
    viewer.role === "ADMIN" ||
    viewer.role === "FACULTY" ||
    viewer.role === "ALUMNI"
  );
}

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
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          repoUrl: true,
          liveUrl: true,
          createdAt: true,
        },
      },
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
    projects: row.projects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      repoUrl: p.repoUrl,
      liveUrl: p.liveUrl,
      createdAt: p.createdAt,
    })),
    // Résumé metadata only (never the storage key or a URL), and only to a
    // viewer allowed to see it. URLs are minted on demand by getResumeForViewer.
    resume:
      row.resumeKey && canViewResume(viewer, targetUserId)
        ? {
            name: row.resumeName,
            size: row.resumeSize,
            uploadedAt: row.resumeUploadedAt,
          }
        : null,
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

// ── Portfolio projects (T-37; docs/PRD M2) ───────────────────────────────────

const PROJECT_SELECT = {
  id: true,
  title: true,
  description: true,
  repoUrl: true,
  liveUrl: true,
  createdAt: true,
} as const;

const PROJECT_LIMIT = 20;

/** The caller's own projects, newest first (soft-deleted rows excluded). */
export async function listOwnProjects(principal: Principal) {
  return prisma.profileProject.findMany({
    where: { userId: principal.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: PROJECT_SELECT,
  });
}

/**
 * Add a project to the caller's own profile. The profile row is a FK target, so
 * we ensure it exists first (a fresh user may not have saved a profile yet) —
 * both writes run in one transaction. A per-profile cap keeps the list bounded.
 */
export async function addOwnProject(principal: Principal, input: ProjectCreateInput) {
  const active = await prisma.profileProject.count({
    where: { userId: principal.userId, deletedAt: null },
  });
  if (active >= PROJECT_LIMIT) {
    throw Errors.validation(`A profile can hold at most ${PROJECT_LIMIT} projects.`, "projects");
  }

  const project = await prisma.$transaction(async (tx) => {
    // Ensure the profile exists so the FK (profile_projects.user_id → profiles)
    // is satisfied for a user who has not filled in their profile yet.
    await tx.profile.upsert({
      where: { userId: principal.userId },
      create: { userId: principal.userId },
      update: {},
    });
    return tx.profileProject.create({
      data: {
        userId: principal.userId,
        title: input.title,
        description: input.description ?? null,
        repoUrl: input.repoUrl ?? null,
        liveUrl: input.liveUrl ?? null,
      },
      select: PROJECT_SELECT,
    });
  });

  await audit({
    action: "profile.project_added",
    actorId: principal.userId,
    target: project.id,
  });
  return project;
}

/**
 * Update one of the caller's OWN projects. Scoped by `userId` so a project id
 * belonging to someone else simply does not match (a generic 404, no existence
 * leak). Only the fields present in the DTO are touched.
 */
export async function updateOwnProject(
  principal: Principal,
  projectId: string,
  input: ProjectUpdateInput,
) {
  const existing = await prisma.profileProject.findFirst({
    where: { id: projectId, userId: principal.userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  const project = await prisma.profileProject.update({
    where: { id: projectId },
    data: {
      title: input.title,
      description: input.description,
      repoUrl: input.repoUrl,
      liveUrl: input.liveUrl,
    },
    select: PROJECT_SELECT,
  });
  await audit({
    action: "profile.project_updated",
    actorId: principal.userId,
    target: projectId,
  });
  return project;
}

/** Soft-delete one of the caller's own projects. Idempotent for the owner. */
export async function removeOwnProject(principal: Principal, projectId: string) {
  const existing = await prisma.profileProject.findFirst({
    where: { id: projectId, userId: principal.userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound();

  await prisma.profileProject.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
  await audit({
    action: "profile.project_removed",
    actorId: principal.userId,
    target: projectId,
  });
  return { id: projectId, removed: true };
}

// ── Résumé (T-44; docs/PRD M2, "Object Storage") ─────────────────────────────

/**
 * Store the caller's résumé: upload the PDF to Supabase Storage, then record its
 * metadata. The profile row is a FK-free target here (columns live ON profiles),
 * so we upsert it first for a user who has not saved a profile yet. Re-uploading
 * overwrites the single object at `<userId>.pdf`.
 */
export async function setOwnResume(
  principal: Principal,
  file: { bytes: Buffer; name: string; size: number },
) {
  if (!resumeStorageConfigured()) {
    throw Errors.validation("Résumé storage is not configured on this deployment.");
  }
  const key = await uploadResumeObject(principal.userId, file.bytes);

  await prisma.profile.upsert({
    where: { userId: principal.userId },
    create: {
      userId: principal.userId,
      resumeKey: key,
      resumeName: file.name,
      resumeSize: file.size,
      resumeUploadedAt: new Date(),
    },
    update: {
      resumeKey: key,
      resumeName: file.name,
      resumeSize: file.size,
      resumeUploadedAt: new Date(),
    },
  });

  await audit({
    action: "profile.resume_uploaded",
    actorId: principal.userId,
    metadata: { size: file.size },
  });
  return { name: file.name, size: file.size };
}

/** Remove the caller's résumé — the stored object and its metadata. Idempotent. */
export async function removeOwnResume(principal: Principal) {
  const profile = await prisma.profile.findUnique({
    where: { userId: principal.userId },
    select: { resumeKey: true },
  });
  if (!profile?.resumeKey) return { removed: true };

  if (resumeStorageConfigured()) {
    try {
      await removeResumeObject(principal.userId);
    } catch (e) {
      // A dangling object is preferable to a metadata row that points nowhere;
      // clear the metadata regardless so the UI reflects "no résumé".
      console.error("resume object delete failed", e);
    }
  }

  await prisma.profile.update({
    where: { userId: principal.userId },
    data: { resumeKey: null, resumeName: null, resumeSize: null, resumeUploadedAt: null },
  });
  await audit({ action: "profile.resume_removed", actorId: principal.userId });
  return { removed: true };
}

/**
 * Résumé metadata + freshly-signed preview/download URLs for a viewer allowed to
 * see it. Returns null when there is no résumé; throws 403 when the viewer is not
 * permitted (a STUDENT viewing another student). URLs are short-lived and minted
 * per request, so nothing durable is ever handed out.
 */
export async function getResumeForViewer(viewer: Principal, targetUserId: string) {
  const profile = await prisma.profile.findFirst({
    where: { userId: targetUserId, deletedAt: null },
    select: { resumeKey: true, resumeName: true, resumeSize: true, resumeUploadedAt: true },
  });
  if (!profile?.resumeKey) return null;
  if (!canViewResume(viewer, targetUserId)) throw Errors.forbidden();
  if (!resumeStorageConfigured()) return null;

  const filename = profile.resumeName ?? "resume.pdf";
  const [previewUrl, downloadUrl] = await Promise.all([
    signResumeUrl(profile.resumeKey),
    signResumeUrl(profile.resumeKey, { download: filename }),
  ]);

  return {
    name: profile.resumeName,
    size: profile.resumeSize,
    uploadedAt: profile.resumeUploadedAt,
    previewUrl,
    downloadUrl,
  };
}
