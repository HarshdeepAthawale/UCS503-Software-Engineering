import { describe, it, expect } from "vitest";
import { jaccard, skillFit } from "@/lib/domain/matching";

/**
 * Skill-matching tests (S5/S6 groundwork). Pure and dependency-free, same
 * reasoning as application-state.test.ts.
 */

describe("jaccard", () => {
  it("is 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("is 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  it("is 0 for two empty sets (no shared basis, not a perfect match)", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("computes intersection over union for a partial overlap", () => {
    // {a,b,c} ∩ {b,c,d} = {b,c} (2); {a,b,c} ∪ {b,c,d} = {a,b,c,d} (4)
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
  });
});

describe("skillFit", () => {
  it("reports matched and missing tags, never a bare score alone", () => {
    const fit = skillFit(["python", "sql"], ["python", "cuda"]);
    expect(fit.matched).toEqual(["python"]);
    expect(fit.missing).toEqual(["cuda"]);
    expect(fit.score).toBeCloseTo(1 / 3);
  });
  it("reports full match when the candidate has every target tag", () => {
    const fit = skillFit(["python", "cuda", "extra"], ["python", "cuda"]);
    expect(fit.matched).toEqual(["python", "cuda"]);
    expect(fit.missing).toEqual([]);
  });
  it("reports every tag missing for a candidate with no overlapping skills", () => {
    const fit = skillFit(["ruby"], ["python", "cuda"]);
    expect(fit.matched).toEqual([]);
    expect(fit.missing).toEqual(["python", "cuda"]);
  });
});
