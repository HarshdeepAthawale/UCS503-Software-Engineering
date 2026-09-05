import Link from "next/link";
import type { Team } from "@/lib/client/api";
import { statusClass } from "@/lib/client/format";

/** Open role slot on a recruiting team card. */
export function openRoles(team: Team) {
  return team.roles.filter((r) => r.slotsFilled < r.slotCount);
}

type TeamRecruitCardProps = {
  team: Team;
  alreadyInvolved?: boolean;
};

/** Card in the join feed — surfaces which roles (frontend, backend, …) are open. */
export function TeamRecruitCard({ team, alreadyInvolved }: TeamRecruitCardProps) {
  const open = openRoles(team);
  const totalSlots = team.roles.reduce((s, r) => s + r.slotCount, 0);
  const filledSlots = team.roles.reduce((s, r) => s + r.slotsFilled, 0);

  return (
    <article className="panel-card team-recruit-card">
      <div className="team-recruit-head">
        <div>
          <h3>{team.name}</h3>
          <p className="sub">{team.hackathon}</p>
        </div>
        <span className={`pill ${statusClass(team.status)}`}>{team.status}</span>
      </div>
      <p className="empty-note">
        Led by {team.lead.name} · {filledSlots} of {totalSlots} slots filled
        {alreadyInvolved ? " · You are already on this team" : ""}
      </p>
      {team.description && (
        <p className="team-recruit-desc">{team.description}</p>
      )}
      <div className="team-recruit-roles" aria-label="Open roles">
        {open.length === 0 ? (
          <span className="empty-note">All roles filled</span>
        ) : (
          open.map((r) => (
            <span key={r.id} className="team-role-open">
              {r.label}
              <span className="team-role-open-count">
                {r.slotCount - r.slotsFilled} open
              </span>
            </span>
          ))
        )}
      </div>
      {team.roles.some((r) => r.skills.length > 0) && (
        <div className="skills-current team-recruit-skills">
          {team.roles.flatMap((r) =>
            r.skills.map((s) => (
              <span key={`${r.id}-${s.id}`} className="tag">
                {r.label}: {s.name}
              </span>
            )),
          )}
        </div>
      )}
      <div className="team-recruit-actions">
        <Link
          className={`btn btn-primary btn-sm${open.length === 0 ? " is-disabled" : ""}`}
          href={`/teams/${team.id}`}
          aria-disabled={open.length === 0}
        >
          {open.length === 0 ? "View team" : "Join team"}
        </Link>
      </div>
    </article>
  );
}
