import type { AppState } from "@prisma/client";

/**
 * Application state machine (T-13; docs/AppFlow §5, PRD M5).
 *
 * A single authoritative transition graph. Keeping it here - pure, dependency-
 * free - means the exact same rules are unit-tested and enforced at runtime, and
 * no illegal transition can be written to the immutable event log.
 *
 *   APPLIED ─┬─► RECEIVED ─┬─► SHORTLISTED ─┬─► INTERVIEW ─┬─► SELECTED (terminal)
 *            │             │                │              └─► REJECTED (terminal)
 *            │             │                ├─► SELECTED
 *            │             │                └─► REJECTED
 *            │             └─► REJECTED
 *            ├─► SHORTLISTED
 *            └─► REJECTED
 *   (any non-terminal) ─► WITHDRAWN (student-initiated, terminal)
 */

/** Poster-driven transitions only. WITHDRAWN is handled on the student path. */
const POSTER_TRANSITIONS: Record<AppState, readonly AppState[]> = {
  APPLIED: ["RECEIVED", "SHORTLISTED", "REJECTED"],
  RECEIVED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "SELECTED", "REJECTED"],
  INTERVIEW: ["SELECTED", "REJECTED"],
  SELECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const TERMINAL_STATES: ReadonlySet<AppState> = new Set<AppState>([
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
]);

/** States that count against a student's concurrent application budget (S3). */
export const ACTIVE_STATES: readonly AppState[] = [
  "APPLIED",
  "RECEIVED",
  "SHORTLISTED",
  "INTERVIEW",
];

export function isTerminal(state: AppState): boolean {
  return TERMINAL_STATES.has(state);
}

/** True iff a poster may move `from` → `to`. */
export function canPosterTransition(from: AppState, to: AppState): boolean {
  return POSTER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A student may withdraw only from a non-terminal state. */
export function canWithdraw(from: AppState): boolean {
  return !isTerminal(from);
}
