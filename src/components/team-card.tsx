import Link from "next/link";
import type { Team } from "@/lib/client/api";
import { openRoles, slotSummary, teamStatusLabel, viewerRelation } from "@/lib/client/team";
import { dateLabel } from "@/lib/client/format";

/**
 * A team as a card: name, event, how full it is, and the roles still open.
 * Used for both "Your teams" and the recruiting list, so every team looks the
 * same wherever it appears.
 */
export function TeamCard({ team, viewerId }: { team: Team; viewerId?: string }) {
  const open = openRoles(team);
  const slots = slotSummary(team);
  const relation = viewerRelation(team, viewerId);
  const pct = slots.total ? Math.round((slots.filled / slots.total) * 100) : 0;

  return (
    <article className="card team-card">
      <header className="team-card-head">
        <div>
          <h3>
            <Link href={`/teams/${team.id}`}>{team.name}</Link>
          </h3>
          <p className="team-card-event">
            {team.hackathon}
            {team.eventDate ? ` · ${dateLabel(team.eventDate)}` : ""}
          </p>
        </div>
        <span className={`status-pill team-${team.status.toLowerCase()}`}>{teamStatusLabel(team.status)}</span>
      </header>

      {team.description && <p className="team-card-desc">{team.description}</p>}

      <div className="team-card-slots">
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <span>
          {slots.filled} of {slots.total} spots filled
        </span>
      </div>

      <div className="chip-row" aria-label="Roles">
        {team.roles.map((r) => {
          const free = r.slotCount - r.slotsFilled;
          return (
            <span key={r.id} className={`role-chip${free > 0 ? "" : " is-full"}`}>
              {r.label}
              <span className="chip-meta">{free > 0 ? `${free} open` : "full"}</span>
            </span>
          );
        })}
      </div>

      <footer className="team-card-foot">
        <span className="team-card-meta">{relation ?? `Led by ${team.lead.name}`}</span>
        <Link className={`btn btn-sm ${open.length > 0 && !relation ? "btn-primary" : "btn-ghost"}`} href={`/teams/${team.id}`}>
          {open.length > 0 && !relation ? "View open roles" : "Open team"}
        </Link>
      </footer>
    </article>
  );
}
