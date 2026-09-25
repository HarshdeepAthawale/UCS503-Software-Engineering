import { describe, it, expect } from "vitest";
import { DEFAULT_FILTERS, filtersFromQuery, filtersToQuery, hasActiveFilters } from "@/lib/client/opportunity-filters";

/** Discovery filters live in the URL, so a search can be shared and survives Back. */

describe("opportunity filters <-> URL", () => {
  it("round-trips every filter", () => {
    const f = { q: "machine learning", type: "RESEARCH" as const, stipend: "true" as const, sort: "deadline" as const };
    expect(filtersFromQuery(new URLSearchParams(filtersToQuery(f)))).toEqual(f);
  });

  it("leaves defaults out of the URL", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    expect(filtersToQuery({ ...DEFAULT_FILTERS, q: "  " })).toBe("");
  });

  it("ignores values that are not real options", () => {
    const f = filtersFromQuery(new URLSearchParams("type=NOPE&sort=evil&stipend=maybe&q=ok"));
    expect(f).toEqual({ ...DEFAULT_FILTERS, q: "ok" });
  });

  it("knows when anything narrows the list", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: "seats" })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, type: "TA" })).toBe(true);
  });
});
