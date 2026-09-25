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

// ── The team form (create and edit share it) ────────────────────────────────

/** A role as the form holds it. `id` is set for a role that already exists. */
export interface DraftRole {
  key: string;
  id?: string;
  label: string;
  slotCount: number;
  skillIds: string[];
  /** Members already in this role: spots cannot go below it, and it cannot be removed. */
  filled?: number;
}

export interface TeamFormValues {
  name: string;
  hackathon: string;
  description: string;
  /** `datetime-local` value (local time), or "" for none. */
  eventDate: string;
  roles: DraftRole[];
}

/** An ISO instant as a `datetime-local` value in the browser's own time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An existing team, ready to edit. */
export function teamToForm(team: Team): TeamFormValues {
  return {
    name: team.name,
    hackathon: team.hackathon,
    description: team.description ?? "",
    eventDate: team.eventDate ? toLocalInput(team.eventDate) : "",
    roles: team.roles.map((r) => ({
      key: r.id,
      id: r.id,
      label: r.label,
      slotCount: r.slotCount,
      skillIds: r.skills.map((s) => s.id),
      filled: r.slotsFilled,
    })),
  };
}

/** What the API takes: trimmed text, an ISO date or null, and each role's id when it has one. */
export function teamPayload(v: TeamFormValues): {
  name: string;
  hackathon: string;
  description: string | null;
  eventDate: string | null;
  roles: { id?: string; label: string; slotCount: number; skillIds: string[] }[];
} {
  return {
    name: v.name.trim(),
    hackathon: v.hackathon.trim(),
    description: v.description.trim() || null,
    eventDate: v.eventDate ? new Date(v.eventDate).toISOString() : null,
    roles: v.roles.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      label: r.label.trim(),
      slotCount: Math.max(Number(r.slotCount) || 1, r.filled ?? 0, 1),
      skillIds: r.skillIds,
    })),
  };
}
