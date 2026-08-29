import { handler, ok, noContent } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { validateResume, resumeErrorMessage, MAX_RESUME_BYTES } from "@/lib/domain/resume";
import { setOwnResume, removeOwnResume } from "@/lib/services/profile.service";

export const runtime = "nodejs";

/**
 * POST   /api/profiles/me/resume - upload/replace the caller's résumé (PDF).
 *        multipart/form-data with a single `file` field. Validated by declared
 *        type, byte length, AND magic bytes before it ever reaches storage.
 * DELETE /api/profiles/me/resume - remove the caller's résumé.
 *
 * Both require `profile:update` + ownership, the same fail-closed pattern as the
 * other "me" sub-resources.
 */
export const POST = handler(async (req) => {
  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    throw Errors.validation("Attach a PDF file in the `file` field.", "file");
  }
  // Guard the size before buffering the whole thing into memory.
  if (file.size > MAX_RESUME_BYTES) {
    throw Errors.validation(resumeErrorMessage("TOO_LARGE"), "file");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const err = validateResume({
    size: bytes.length,
    contentType: file.type || "",
    header: bytes.subarray(0, 8),
  });
  if (err) throw Errors.validation(resumeErrorMessage(err), "file");

  const name = sanitizeFilename(file.name);
  const saved = await setOwnResume(principal, { bytes, name, size: bytes.length });
  return ok({ resume: saved });
});

export const DELETE = handler(async (req) => {
  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  await removeOwnResume(principal);
  return noContent();
});

/** Keep a readable, safe display name: strip paths, cap length, default to PDF. */
function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "resume.pdf";
  const trimmed = base.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : "resume.pdf";
}
