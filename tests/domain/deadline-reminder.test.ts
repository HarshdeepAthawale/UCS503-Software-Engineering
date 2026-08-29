import { describe, it, expect } from "vitest";
import {
  DEADLINE_TIERS,
  DEADLINE_TIER_ORDER,
  reminderTierFor,
} from "@/lib/domain/deadline-reminder";

/** Deadline-reminder tier boundaries (T-35; docs/PRD M8). Pure, DB-free. */

const H = 3_600_000; // one hour in ms
const NOW = new Date("2026-08-29T00:00:00.000Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * H);

describe("reminderTierFor", () => {
  it("returns null when the deadline is more than 72h away", () => {
    expect(reminderTierFor(inHours(73), NOW)).toBeNull();
    expect(reminderTierFor(inHours(100), NOW)).toBeNull();
  });

  it("returns null when the deadline has already passed", () => {
    expect(reminderTierFor(inHours(-1), NOW)).toBeNull();
    expect(reminderTierFor(NOW, NOW)).toBeNull();
  });

  it("picks T72 for the (24h, 72h] window", () => {
    expect(reminderTierFor(inHours(72), NOW)).toBe("T72");
    expect(reminderTierFor(inHours(48), NOW)).toBe("T72");
    expect(reminderTierFor(inHours(24.5), NOW)).toBe("T72");
  });

  it("picks T24 for the (0h, 24h] window", () => {
    expect(reminderTierFor(inHours(24), NOW)).toBe("T24");
    expect(reminderTierFor(inHours(1), NOW)).toBe("T24");
  });

  it("treats the tier windows as non-overlapping at the 24h seam", () => {
    // Exactly 24h out belongs to T24 (upper bound is inclusive), not T72.
    expect(reminderTierFor(inHours(24), NOW)).toBe("T24");
    // Just over 24h out belongs to T72.
    expect(reminderTierFor(inHours(24.001), NOW)).toBe("T72");
  });

  it("gives a short-deadline posting only its single correct tier", () => {
    // Created with 20h left → T24 only, never a redundant T72.
    expect(reminderTierFor(inHours(20), NOW)).toBe("T24");
  });
});

describe("DEADLINE_TIERS", () => {
  it("defines contiguous, non-overlapping windows covering 0–72h", () => {
    expect(DEADLINE_TIERS.T24).toEqual({ lowerH: 0, upperH: 24 });
    expect(DEADLINE_TIERS.T72).toEqual({ lowerH: 24, upperH: 72 });
    // T24's upper bound is T72's lower bound — no gap, no overlap.
    expect(DEADLINE_TIERS.T24.upperH).toBe(DEADLINE_TIERS.T72.lowerH);
  });

  it("sweeps the farther-out tier first", () => {
    expect(DEADLINE_TIER_ORDER).toEqual(["T72", "T24"]);
  });
});
