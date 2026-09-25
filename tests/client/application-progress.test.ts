import { describe, it, expect } from "vitest";
import { isActive, progressSteps, waitingOnPoster } from "@/lib/client/application-progress";
import type { AppState } from "@/lib/client/api";

/** The student's view of one application: how far it got, and whether it is waiting too long. */

const H = 3_600_000;
const NOW = new Date("2026-09-20T12:00:00Z").getTime();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString();

function app(status: AppState, path: [AppState, number][]) {
  return {
    status,
    appliedAt: at(path[0]![1]),
    firstTransitionAt: path[1] ? at(path[1][1]) : null,
    events: path.map(([toState, hoursAgo], i) => ({
      fromState: i === 0 ? null : path[i - 1]![0],
      toState,
      createdAt: at(hoursAgo),
    })),
  };
}

const states = (a: ReturnType<typeof app>) => progressSteps(a).map((s) => `${s.label}:${s.state}`);

describe("progressSteps", () => {
  it("shows a fresh application as waiting for review", () => {
    expect(states(app("APPLIED", [["APPLIED", 5]]))).toEqual([
      "Applied:done", "Shortlisted:current", "Interview:upcoming", "Decision:upcoming",
    ]);
  });

  it("dates every step that happened", () => {
    const steps = progressSteps(app("INTERVIEW", [["APPLIED", 90], ["SHORTLISTED", 60], ["INTERVIEW", 10]]));
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
    expect(steps[2]!.at).toBe(at(10));
  });

  it("marks a step the poster jumped over as skipped", () => {
    expect(states(app("SELECTED", [["APPLIED", 90], ["SHORTLISTED", 60], ["SELECTED", 10]]))).toEqual([
      "Applied:done", "Shortlisted:done", "Interview:skipped", "Selected:done",
    ]);
  });

  it("names the decision - and a rejection straight from Applied skips the rest", () => {
    expect(states(app("REJECTED", [["APPLIED", 90], ["REJECTED", 30]]))).toEqual([
      "Applied:done", "Shortlisted:skipped", "Interview:skipped", "Not selected:done",
    ]);
    expect(states(app("WITHDRAWN", [["APPLIED", 90], ["WITHDRAWN", 30]])).at(-1)).toBe("Withdrawn:done");
  });
});

describe("waitingOnPoster", () => {
  it("counts the wait while nobody has acknowledged the application", () => {
    const w = waitingOnPoster(app("APPLIED", [["APPLIED", 30]]), "H48", NOW);
    expect(w).toEqual({ hours: 30, promisedHours: 48, overdue: false });
  });

  it("flags a broken reply promise", () => {
    expect(waitingOnPoster(app("APPLIED", [["APPLIED", 80]]), "H48", NOW)?.overdue).toBe(true);
  });

  it("stops counting once the poster has acted or the application is closed", () => {
    expect(waitingOnPoster(app("SHORTLISTED", [["APPLIED", 80], ["SHORTLISTED", 70]]), "H48", NOW)).toBeNull();
    expect(waitingOnPoster(app("WITHDRAWN", [["APPLIED", 80], ["WITHDRAWN", 70]]), "H48", NOW)).toBeNull();
  });
});

describe("isActive", () => {
  it("counts only undecided applications", () => {
    expect(["APPLIED", "RECEIVED", "SHORTLISTED", "INTERVIEW"].every((s) => isActive(s as AppState))).toBe(true);
    expect(["SELECTED", "REJECTED", "WITHDRAWN"].some((s) => isActive(s as AppState))).toBe(false);
  });
});
