import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { getProfile } from "@/lib/services/profile.service";

export const runtime = "nodejs";

/**
 * GET /api/profiles/:userId — view another user's profile.
 * Requires authentication + `profile:read`. Field-level privacy (CGPA) is applied
 * inside the service based on the viewer. Returns a generic 404 when the profile
 * does not exist (no existence leak).
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "profile:read");

  // Resolve the dynamic segment from the URL (App Router passes it via context,
  // but reading from the pathname keeps this handler self-contained).
  const userId = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw Errors.notFound();

  const profile = await getProfile(principal, userId);
  if (!profile) throw Errors.notFound();
  return ok({ profile });
});
