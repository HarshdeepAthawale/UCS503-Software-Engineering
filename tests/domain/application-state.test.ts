import { describe, it, expect } from "vitest";
import {
  ACTIVE_STATES,
  TERMINAL_STATES,
  canPosterTransition,
  canWithdraw,
  isTerminal,
} from "@/lib/domain/application-state";

/**
 * Application state-machine tests (T-13). The graph is the single authority for
 * both runtime enforcement and these tests, so no illegal transition can reach
 * the immutable event log.
 */

describe("poster transitions", () => {
  it("allows the forward pipeline from APPLIED", () => {
    expect(canPosterTransition("APPLIED", "SHORTLISTED")).toBe(true);
    expect(canPosterTransition("APPLIED", "REJECTED")).toBe(true);
  });

  it("no longer offers RECEIVED as a poster transition", () => {
    expect(canPosterTransition("APPLIED", "RECEIVED")).toBe(false);
  });

  it("still lets a pre-existing RECEIVED row move forward (legacy data)", () => {
    expect(canPosterTransition("RECEIVED", "SHORTLISTED")).toBe(true);
    expect(canPosterTransition("RECEIVED", "REJECTED")).toBe(true);
  });

  it("forbids skipping straight to SELECTED/INTERVIEW from APPLIED", () => {
    expect(canPosterTransition("APPLIED", "SELECTED")).toBe(false);
    expect(canPosterTransition("APPLIED", "INTERVIEW")).toBe(false);
  });

  it("allows SELECTED/REJECTED only from a shortlisted/interview stage", () => {
    expect(canPosterTransition("SHORTLISTED", "SELECTED")).toBe(true);
    expect(canPosterTransition("INTERVIEW", "SELECTED")).toBe(true);
    expect(canPosterTransition("RECEIVED", "SELECTED")).toBe(false);
  });

  it("forbids any transition out of a terminal state", () => {
    for (const t of ["SELECTED", "REJECTED", "WITHDRAWN"] as const) {
      expect(canPosterTransition(t, "RECEIVED")).toBe(false);
    }
  });

  it("never lets a poster move an application to WITHDRAWN", () => {
    expect(canPosterTransition("APPLIED", "WITHDRAWN" as never)).toBe(false);
  });
});

describe("withdrawal (student)", () => {
  it("is allowed from any non-terminal state", () => {
    expect(canWithdraw("APPLIED")).toBe(true);
    expect(canWithdraw("INTERVIEW")).toBe(true);
  });
  it("is ALSO allowed from SELECTED - declining an accepted offer releases the seat", () => {
    expect(canWithdraw("SELECTED")).toBe(true);
  });
  it("is refused only once already resolved negatively", () => {
    expect(canWithdraw("REJECTED")).toBe(false);
    expect(canWithdraw("WITHDRAWN")).toBe(false);
  });
});

describe("classification", () => {
  it("marks the three terminal states", () => {
    expect([...TERMINAL_STATES].sort()).toEqual(["REJECTED", "SELECTED", "WITHDRAWN"]);
    expect(isTerminal("APPLIED")).toBe(false);
  });
  it("counts only open states against budget", () => {
    expect([...ACTIVE_STATES]).toEqual(["APPLIED", "RECEIVED", "SHORTLISTED", "INTERVIEW"]);
    expect(ACTIVE_STATES).not.toContain("SELECTED");
    expect(ACTIVE_STATES).not.toContain("REJECTED");
  });
});
