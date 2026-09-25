import { describe, it, expect } from "vitest";
import {
  SLA_HOURS,
  badgeFromMedian,
  medianMs,
  medianTtaHours,
  RESPONSIVENESS_WINDOW_DAYS,
  summarizeResponsiveness,
} from "@/lib/domain/responsiveness";

/** TTA & responsiveness math (T-14 / T-15). Pure functions, exercised directly. */

const H = 3_600_000; // one hour in ms

describe("medianMs", () => {
  it("returns null for no data", () => {
    expect(medianMs([])).toBeNull();
  });
  it("takes the middle of an odd-length set", () => {
    expect(medianMs([1, 5, 3])).toBe(3);
  });
  it("averages the two middle values of an even-length set", () => {
    expect(medianMs([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("medianTtaHours", () => {
  it("rounds the median to whole hours", () => {
    expect(medianTtaHours([10 * H, 20 * H, 30 * H])).toBe(20);
  });
  it("is null with no acknowledged applications", () => {
    expect(medianTtaHours([])).toBeNull();
  });
});

describe("badgeFromMedian", () => {
  it("shows NEW below the minimum sample size", () => {
    expect(badgeFromMedian(5, 2)).toBe("NEW");
    expect(badgeFromMedian(null, 0)).toBe("NEW");
  });
  it("maps median hours to the right band", () => {
    expect(badgeFromMedian(12, 5)).toBe("HIGHLY_RESPONSIVE");
    expect(badgeFromMedian(24, 5)).toBe("HIGHLY_RESPONSIVE");
    expect(badgeFromMedian(48, 5)).toBe("RESPONSIVE");
    expect(badgeFromMedian(120, 5)).toBe("SLOW");
    expect(badgeFromMedian(200, 5)).toBe("UNRESPONSIVE");
  });
});

describe("SLA_HOURS", () => {
  it("maps each pledge to its window", () => {
    expect(SLA_HOURS.H24).toBe(24);
    expect(SLA_HOURS.H48).toBe(48);
    expect(SLA_HOURS.WEEK).toBe(168);
  });
});

describe("summarizeResponsiveness", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * H);

  /** Acknowledged `ttaHours` after applying, `ageHours` ago. */
  const acked = (ageHours: number, ttaHours: number) => ({
    appliedAt: ago(ageHours),
    firstTransitionAt: ago(ageHours - ttaHours),
    status: "SHORTLISTED" as const,
    slaPledge: "H48" as const,
  });
  /** Never acknowledged, applied `ageHours` ago. */
  const silent = (ageHours: number, slaPledge: "H24" | "H48" | "WEEK" = "H48") => ({
    appliedAt: ago(ageHours),
    firstTransitionAt: null,
    status: "APPLIED" as const,
    slaPledge,
  });

  it("does not reward a poster who answers a few fast and ghosts the rest", () => {
    const rows = [acked(100, 2), acked(100, 3), acked(100, 4), ...Array.from({ length: 10 }, () => silent(200))];
    const r = summarizeResponsiveness(rows, now);
    expect(r.medianTtaHours).toBe(3);
    expect(r.responseRate).toBeCloseTo(3 / 13);
    expect(r.sampleSize).toBe(13);
    expect(r.badge).toBe("UNRESPONSIVE");
  });

  it("caps a partly-responsive poster at SLOW however fast their replies are", () => {
    const rows = [acked(100, 1), acked(100, 1), acked(100, 1), silent(200)]; // 75% answered
    expect(summarizeResponsiveness(rows, now).badge).toBe("SLOW");
  });

  it("keeps the median band when nearly every applicant is answered", () => {
    const rows = [acked(100, 10), acked(100, 12), acked(100, 14), acked(100, 30)];
    const r = summarizeResponsiveness(rows, now);
    expect(r.responseRate).toBe(1);
    expect(r.badge).toBe("HIGHLY_RESPONSIVE");
  });

  it("does not count an application still inside its SLA window against the poster", () => {
    const rows = [acked(100, 5), acked(100, 5), acked(100, 5), silent(10, "H24"), silent(100, "WEEK")];
    const r = summarizeResponsiveness(rows, now);
    expect(r.responseRate).toBe(1);
    expect(r.sampleSize).toBe(3);
  });

  it("ignores a withdrawal that was never acknowledged", () => {
    const withdrawn = { ...silent(200), status: "WITHDRAWN" as const };
    const rows = [acked(100, 5), acked(100, 5), acked(100, 5), withdrawn];
    expect(summarizeResponsiveness(rows, now).responseRate).toBe(1);
  });

  it("is a rolling window: applications older than it do not count", () => {
    const old = RESPONSIVENESS_WINDOW_DAYS * 24 + 1;
    const rows = [acked(100, 5), acked(100, 5), acked(100, 5), silent(old), silent(old), silent(old)];
    const r = summarizeResponsiveness(rows, now);
    expect(r.responseRate).toBe(1);
    expect(r.badge).toBe("HIGHLY_RESPONSIVE");
  });

  it("calls a poster who has ignored everyone UNRESPONSIVE, not NEW", () => {
    const r = summarizeResponsiveness([silent(200), silent(200), silent(200)], now);
    expect(r.medianTtaHours).toBeNull();
    expect(r.responseRate).toBe(0);
    expect(r.badge).toBe("UNRESPONSIVE");
  });

  it("shows NEW below the minimum sample and a null rate with no data", () => {
    expect(summarizeResponsiveness([acked(100, 1), silent(200)], now).badge).toBe("NEW");
    const empty = summarizeResponsiveness([], now);
    expect(empty.badge).toBe("NEW");
    expect(empty.responseRate).toBeNull();
  });
});
