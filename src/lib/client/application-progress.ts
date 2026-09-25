import type { AppState, SlaPledge } from "@/lib/client/api";

/**
 * One application as the student follows it: four steps from Applied to a
 * decision, each dated from the immutable event log, and - while nobody has
 * acknowledged it - how long it has waited against the poster's promise.
 */

export type StepState = "done" | "current" | "upcoming" | "skipped";

export interface ProgressStep {
  label: string;
  state: StepState;
  /** When the step happened (ISO), for done steps. */
  at: string | null;
}

interface TrackedApplication {
  status: AppState;
  appliedAt: string;
  firstTransitionAt: string | null;
  events: { fromState: AppState | null; toState: AppState; createdAt: string }[];
}

const ACTIVE: readonly AppState[] = ["APPLIED", "RECEIVED", "SHORTLISTED", "INTERVIEW"];
const DECISION_LABEL: Partial<Record<AppState, string>> = {
  SELECTED: "Selected",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};
/** Mirrors SLA_HOURS in lib/domain/responsiveness.ts. */
const PLEDGE_HOURS: Record<SlaPledge, number> = { H24: 24, H48: 48, WEEK: 168 };

export function isActive(status: AppState): boolean {
  return ACTIVE.includes(status);
}

export function progressSteps(app: TrackedApplication): ProgressStep[] {
  const when = (s: AppState) => app.events.find((e) => e.toState === s)?.createdAt ?? null;
  const decided = !isActive(app.status);
  const shortlisted = when("SHORTLISTED");
  const interview = when("INTERVIEW");

  // The one pending step while the application is still open.
  const next: "shortlist" | "interview" | "decision" =
    app.status === "APPLIED" || app.status === "RECEIVED" ? "shortlist" : app.status === "SHORTLISTED" ? "interview" : "decision";
  const pending = (key: typeof next): StepState => (next === key ? "current" : "upcoming");

  return [
    { label: "Applied", state: "done", at: when("APPLIED") ?? app.appliedAt },
    {
      label: "Shortlisted",
      state: shortlisted ? "done" : decided ? "skipped" : pending("shortlist"),
      at: shortlisted,
    },
    {
      label: "Interview",
      state: interview ? "done" : decided || (shortlisted && app.status !== "SHORTLISTED") ? "skipped" : pending("interview"),
      at: interview,
    },
    decided
      ? { label: DECISION_LABEL[app.status] ?? "Decision", state: "done", at: when(app.status) }
      : { label: "Decision", state: pending("decision"), at: null },
  ];
}

/**
 * How long an unacknowledged application has waited, against the reply time
 * the poster promised. Null once the poster has acted or the application is
 * closed - then there is nothing to wait for.
 */
export function waitingOnPoster(
  app: TrackedApplication,
  pledge: SlaPledge,
  now = Date.now(),
): { hours: number; promisedHours: number; overdue: boolean } | null {
  if (app.firstTransitionAt || !isActive(app.status)) return null;
  const hours = Math.floor((now - new Date(app.appliedAt).getTime()) / 3_600_000);
  const promisedHours = PLEDGE_HOURS[pledge];
  return { hours, promisedHours, overdue: hours > promisedHours };
}
