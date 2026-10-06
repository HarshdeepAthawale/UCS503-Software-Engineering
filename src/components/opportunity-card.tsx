import Link from "next/link";
import type { Opportunity } from "@/lib/client/api";
import { closesLabel, oppTypeLabel, slaLabel, stipendLabel, titleCase } from "@/lib/client/format";
import { eligibility, type EligibilityProfile } from "@/lib/client/eligibility";

const SKILLS_SHOWN = 4;
const URGENT_DAYS = 3;

/**
 * A posting in the discovery grid. Answers "should I apply?" at a glance: what
 * it is, who posted it, when it closes (red when close), pay, seats left, the
 * poster's promised reply time and - for a student - whether they qualify.
 * The whole card is one link (the title's ::after covers it).
 */
export function OpportunityCard({
  opportunity: o,
  viewer,
}: {
  opportunity: Opportunity;
  /** A student's eligibility fields; omitted for posters and admins. */
  viewer?: EligibilityProfile | null;
}) {
  const seatsLeft = o.seatCount - o.seatsFilled;
  const daysLeft = (new Date(o.deadline).getTime() - Date.now()) / 86_400_000;
  const closed = o.status === "CLOSED" || daysLeft <= 0;
  const urgent = !closed && daysLeft <= URGENT_DAYS;
  const fit = viewer !== undefined ? eligibility(o, viewer) : null;
  const extraSkills = o.skills.length - SKILLS_SHOWN;

  return (
    <article className="card opp-card">
      <header className="opp-card-top">
        <span className="opp-card-type">{oppTypeLabel(o.type)}</span>
        <span className={`deadline-chip${urgent ? " is-urgent" : ""}${closed ? " is-closed" : ""}`}>
          {closed ? "Closed" : closesLabel(o.deadline)}
        </span>
      </header>

      <h3 className="opp-card-title">
        <Link href={`/opportunities/${o.id}`}>{o.title}</Link>
      </h3>
      <p className="opp-card-poster">
        {o.poster.name} · {o.poster.role === "ALUMNI" ? "Verified alumnus" : titleCase(o.poster.role)}
      </p>
      <p className="opp-card-desc">{o.description}</p>

      {o.skills.length > 0 && (
        <div className="chip-row">
          {o.skills.slice(0, SKILLS_SHOWN).map((s) => (
            <span key={s.id} className={`skill-tag${s.requirement === "REQUIRED" ? " is-required" : ""}`}
              title={s.requirement === "REQUIRED" ? "Required" : "Preferred"}>
              {s.name}
            </span>
          ))}
          {extraSkills > 0 && <span className="skill-tag">+{extraSkills}</span>}
        </div>
      )}

      <footer className="opp-card-foot">
        <ul className="opp-facts">
          <li>{stipendLabel(o.stipend, o.stipendAmount)}</li>
          <li>{seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left` : "All seats filled"}</li>
          <li>{slaLabel(o.slaPledge)}</li>
        </ul>
        {fit?.restricted && (
          <p className={`fit-line${fit.eligible ? " is-ok" : ""}`}>
            {fit.eligible ? "✓ You're eligible" : `Not eligible · ${fit.reasons.map((r) => r.short).join(" · ")}`}
          </p>
        )}
      </footer>
    </article>
  );
}
