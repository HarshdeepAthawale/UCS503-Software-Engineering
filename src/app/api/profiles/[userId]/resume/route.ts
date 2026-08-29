import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { getResumeForViewer } from "@/lib/services/profile.service";

export const runtime = "nodejs";

/**
 * GET /api/profiles/:userId/resume - résumé metadata + short-lived signed
 * preview/download URLs for a viewer allowed to see it (owner, ADMIN, FACULTY,
 * ALUMNI). The service returns null when there is no résumé (→ 404) and throws
 * 403 when the viewer is a student looking at someone else. Requires
 * authentication + `profile:read`.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "profile:read");

  // second-to-last segment is the userId: /api/profiles/<userId>/resume
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const userId = parts[parts.length - 2] ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw Errors.notFound();

  const resume = await getResumeForViewer(principal, userId);
  if (!resume) throw Errors.notFound();
  return ok({ resume });
});
