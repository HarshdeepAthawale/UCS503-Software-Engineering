import { describe, it, expect } from "vitest";
import {
  SLA_HOURS,
  badgeFromMedian,
  medianMs,
  medianTtaHours,
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
