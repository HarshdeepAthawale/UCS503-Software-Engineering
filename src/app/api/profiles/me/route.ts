import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { ProfileUpdateSchema } from "@/lib/validation/schemas";
import { getProfile, updateOwnProfile } from "@/lib/services/profile.service";

export const runtime = "nodejs";

/**
 * GET /api/profiles/me - the caller's own profile (owner sees private CGPA).
 * Requires `profile:read`.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "profile:read");
  const profile = await getProfile(principal, principal.userId);
  return ok({ profile });
});

/**
 * PATCH /api/profiles/me - update own profile via a strict allow-list DTO.
 * Requires `profile:update` AND ownership. For the "me" resource the owner is
 * always the caller, so we resolve the principal first, then run the ownership-
 * scoped authorization with the concrete owner id (fail-closed by design).
 */
export const PATCH = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const principal = await requireAuth(req);
  // Ownership-scoped check: owner is the caller. A read-only status (UNVERIFIED /
  // PENDING_ALUMNI / SUSPENDED) is rejected here before any write occurs.
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const saved = await updateOwnProfile(principal, parsed.data);
  return ok({ profile: saved });
});
