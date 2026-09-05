import { handler, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AttestationCreateSchema } from "@/lib/validation/schemas";
import { getAttestationRefs, issueAttestation } from "@/lib/services/attestation.service";

export const runtime = "nodejs";

/**
 * POST /api/applications/:id/attestations - the POSTER issues an attestation
 * on a SELECTED application (T-19). Ownership is the opportunity's poster,
 * same as `opportunity:transition`; `attestation:create` is ownership-scoped.
 */

function applicationIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("applications");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const POST = handler(async (req) => {
  const id = applicationIdFromPath(req);
  const refs = await getAttestationRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "attestation:create", { ownerId: refs.posterId });

  const body = await req.json().catch(() => null);
  const parsed = AttestationCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const attestation = await issueAttestation(principal, id, parsed.data);
  return created({ attestation });
});
