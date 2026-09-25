import type { Team, TeamRole, TeamStatus } from "@/lib/client/api";

/** How a team is described on the teams pages - one place, not per page. */

const STATUS_LABEL: Record<TeamStatus, string> = {
  FORMING: "Recruiting",
  LOCKED: "Team complete",
  CLOSED: "Closed",
};

export function teamStatusLabel(status: TeamStatus): string {
  return STATUS_LABEL[status];
}

/** Filled / total / open slots across every role on the team. */
export function slotSummary(team: Team): { filled: number; total: number; open: number } {
  const total = team.roles.reduce((s, r) => s + r.slotCount, 0);
  const filled = team.roles.reduce((s, r) => s + r.slotsFilled, 0);
  return { filled, total, open: total - filled };
}

/** Roles that still have a free slot. */
export function openRoles(team: Pick<Team, "roles">): TeamRole[] {
  return team.roles.filter((r) => r.slotsFilled < r.slotCount);
}

const REQUEST_LABEL: Record<NonNullable<TeamRole["myRequest"]>["status"], string> = {
  PENDING: "Request pending",
  ACCEPTED: "Request accepted",
  REJECTED: "Request not accepted",
  WITHDRAWN: "Request withdrawn",
};

/** The viewer's place on a team, or null when they have no connection to it. */
export function viewerRelation(team: Team, userId: string | undefined): string | null {
  if (!userId) return null;
  if (team.lead.id === userId) return "You lead this team";
  if (team.members.some((m) => m.userId === userId)) return "You're a member";
  const role = team.roles.find((r) => r.myRequest);
  return role?.myRequest ? `${REQUEST_LABEL[role.myRequest.status]} · ${role.label}` : null;
}
