import { prisma } from "@/lib/db";

/**
 * Append-only audit logging for privileged and security-relevant events
 * (docs/TechSpec §7). Store rationale codes and identifiers only — never raw
 * tokens, passwords, OTPs, or other PII (codeguard-0-logging).
 */
export type AuditAction =
  | "auth.register"
  | "auth.verify_otp"
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.refresh.rotated"
  | "auth.refresh.reuse_detected"
  | "auth.logout"
  | "alumni.claim.submitted"
  | "alumni.claim.decided"
  | "profile.updated"
  | "profile.skills_replaced"
  | "skill.created"
  | "skill.updated"
  | "skill.deleted"
  | "opportunity.created"
  | "opportunity.updated"
  | "opportunity.closed"
  | "opportunity.expired"
  | "authz.denied";

export async function audit(params: {
  action: AuditAction;
  actorId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId ?? null,
        target: params.target ?? null,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (e) {
    // Auditing must never break the request path; log and continue.
    console.error("audit write failed", e);
  }
}
