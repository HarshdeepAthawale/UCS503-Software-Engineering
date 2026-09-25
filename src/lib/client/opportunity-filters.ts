import type { OppType, OpportunitySort } from "@/lib/client/api";

/**
 * Discovery filters, kept in the page URL (?q=&type=&stipend=&sort=) so a
 * search can be shared, bookmarked and restored by the Back button. Anything
 * that is not a real option is dropped rather than sent to the API.
 */

export interface OpportunityFilters {
  q: string;
  type: "" | OppType;
  stipend: "" | "true" | "false";
  sort: OpportunitySort;
}

export const DEFAULT_FILTERS: OpportunityFilters = { q: "", type: "", stipend: "", sort: "recent" };

const TYPES: readonly OppType[] = ["RESEARCH", "INTERNSHIP", "TA", "HACKATHON_TEAM", "MICRO_TASK", "REFERRAL"];
const SORTS: readonly OpportunitySort[] = ["recent", "deadline", "seats"];

export function filtersFromQuery(params: URLSearchParams): OpportunityFilters {
  const type = params.get("type") ?? "";
  const stipend = params.get("stipend") ?? "";
  const sort = params.get("sort") ?? "";
  return {
    q: params.get("q") ?? "",
    type: (TYPES as readonly string[]).includes(type) ? (type as OppType) : "",
    stipend: stipend === "true" || stipend === "false" ? stipend : "",
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as OpportunitySort) : DEFAULT_FILTERS.sort,
  };
}

/** The query string for these filters, without defaults ("" when all default). */
export function filtersToQuery(f: OpportunityFilters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type) p.set("type", f.type);
  if (f.stipend) p.set("stipend", f.stipend);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  return p.toString();
}

/** True when a filter narrows the list (sorting alone does not). */
export function hasActiveFilters(f: OpportunityFilters): boolean {
  return Boolean(f.q.trim() || f.type || f.stipend);
}
