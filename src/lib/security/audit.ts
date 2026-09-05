import { prisma } from "@/lib/db";

/**
 * Append-only audit logging for privileged and security-relevant events
 * (docs/TechSpec §7). Store rationale codes and identifiers only - never raw
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
  | "auth.login_otp.requested"
  | "user.role_changed"
  | "user.status_changed"
  | "user.provisioned"
  | "faculty_allowlist.added"
  | "faculty_allowlist.removed"
  | "alumni.claim.submitted"
  | "alumni.claim.decided"
  | "profile.updated"
  | "profile.skills_replaced"
  | "profile.project_added"
  | "profile.project_updated"
  | "profile.project_removed"
  | "profile.resume_uploaded"
  | "profile.resume_removed"
  | "skill.created"
  | "skill.updated"
  | "skill.deleted"
  | "opportunity.created"
  | "opportunity.updated"
  | "opportunity.closed"
  | "opportunity.expired"
  | "opportunity.at_risk"
  | "opportunity.deadline_reminder"
  | "opportunity.removed"
  | "flag.created"
  | "flag.resolved"
  | "flag.dismissed"
  | "application.created"
  | "application.transitioned"
  | "application.withdrawn"
  | "attestation.issued"
  | "team.created"
  | "team.join_requested"
  | "team.request_decided"
  | "team.request_withdrawn"
  | "team.closed"
  | "meeting.scheduled"
  | "meeting.cancelled"
  | "calendar.connected"
  | "calendar.disconnected"
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
