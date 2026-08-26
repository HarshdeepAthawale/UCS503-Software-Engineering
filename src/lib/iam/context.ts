import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/access-token";
import type { Principal } from "./policy";

/**
 * Resolve the authenticated principal for a request.
 *
 * The bearer token proves *authentication* and identifies the subject, but the
 * authoritative `role` and `status` are re-loaded from the database on every
 * request. This means a suspension, role change, or soft-delete takes effect
 * immediately — a stolen or stale token cannot outrun a revocation
 * (defense-in-depth over the token's own claims).
 */
export async function getPrincipal(req: Request): Promise<Principal | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  const user = await prisma.user.findFirst({
    where: { id: claims.sub, deletedAt: null },
    select: { id: true, role: true, status: true },
  });
  if (!user) return null;

  return { userId: user.id, role: user.role, status: user.status };
}
