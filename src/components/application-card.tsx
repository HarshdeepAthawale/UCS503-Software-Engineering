import Link from "next/link";
import type { MyApplication } from "@/lib/client/api";
import { dateLabel, deadlineLabel, oppTypeLabel, REJECTION_REASONS, titleCase } from "@/lib/client/format";
import { progressSteps, waitingOnPoster } from "@/lib/client/application-progress";

function waitLabel(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function promiseLabel(hours: number): string {
  return hours >= 168 ? "a week" : `${hours}h`;
}

/**
 * One application in the student's tracker: the posting, a four-step timeline
 * dated from the event log, and - while nobody has answered - how long it has
 * waited against the poster's promised reply time. The whole card links to the
 * application (status, messages, withdraw).
 */
export function ApplicationCard({ app }: { app: MyApplication }) {
  const steps = progressSteps(app);
  const wait = waitingOnPoster(app, app.opportunity.slaPledge);
  const reason = REJECTION_REASONS.find((r) => r.value === app.rejectionCode)?.label;

  return (
    <article className={`card app-card status-${app.status.toLowerCase()}`}>
      <header className="app-card-head">
        <div>
          <span className="opp-card-type">{oppTypeLabel(app.opportunity.type)}</span>
          <h3 className="app-card-title">
            <Link href={`/applications/${app.id}`}>{app.opportunity.title}</Link>
          </h3>
          <p className="app-card-meta">
            {app.opportunity.poster.name} · {titleCase(app.opportunity.poster.role)} · applied {dateLabel(app.appliedAt)}
          </p>
        </div>
      </header>

      <ol className="progress" aria-label="Application progress">
        {steps.map((s) => (
          <li key={s.label} className={`progress-step is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
            <span className="progress-dot" aria-hidden="true">{s.state === "done" ? "✓" : ""}</span>
            <span className="progress-label">{s.label}</span>
            <span className="progress-date">
              {s.at ? dateLabel(s.at) : s.state === "skipped" ? "Skipped" : s.state === "current" ? "Waiting" : ""}
            </span>
          </li>
        ))}
      </ol>

      {wait && (
        <p className={`wait-line${wait.overdue ? " is-overdue" : ""}`}>
          {wait.overdue
            ? `No reply for ${waitLabel(wait.hours)} - the poster promised one within ${promiseLabel(wait.promisedHours)}.`
            : `Waiting ${waitLabel(wait.hours)} · reply promised within ${promiseLabel(wait.promisedHours)}.`}
        </p>
      )}
      {app.status === "REJECTED" && reason && <p className="wait-line">Reason given: {reason}</p>}
      {app.status === "SELECTED" && <p className="wait-line is-good">You were selected. Open the application to message the poster.</p>}
      {!wait && (app.status === "SHORTLISTED" || app.status === "INTERVIEW") && (
        <p className="wait-line">
          {deadlineLabel(app.opportunity.deadline) === "closed"
            ? "The posting has stopped taking applications - the poster is still deciding."
            : `You're still in the running. Applications close ${deadlineLabel(app.opportunity.deadline)}.`}
        </p>
      )}
    </article>
  );
}
