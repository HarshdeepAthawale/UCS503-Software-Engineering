"use client";

import { FacetTextInput, FilterSelect } from "@/components/filter-select";
import type { OppType, OpportunitySort } from "@/lib/client/api";
import { oppTypeHint, oppTypeLabel, POSTING_OPP_TYPES } from "@/lib/client/format";

const SORTS: { value: OpportunitySort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "deadline", label: "Closing soon" },
  { value: "seats", label: "Most seats open" },
];

const FILTER_TYPES = [...POSTING_OPP_TYPES, "HACKATHON_TEAM"] as const;

export type OpportunityFilters = {
  q: string;
  type: "" | OppType;
  domain: string;
  stipend: "" | "true" | "false";
  sort: OpportunitySort;
};

type OpportunityFacetBarProps = {
  filters: OpportunityFilters;
  onChange: (patch: Partial<OpportunityFilters>) => void;
  onClear: () => void;
  resultCount: number;
  loading: boolean;
};

function hasActiveFilters(f: OpportunityFilters) {
  return Boolean(f.q.trim() || f.type || f.domain.trim() || f.stipend);
}

export function OpportunityFacetBar({
  filters,
  onChange,
  onClear,
  resultCount,
  loading,
}: OpportunityFacetBarProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className="opp-facet-panel">
      <div className="opp-facet-search">
        <label className="sr-only" htmlFor="opp-search">Search opportunities</label>
        <input
          id="opp-search"
          type="search"
          className="opp-facet-search-input"
          placeholder="Search titles & descriptions…"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>

      <div className="facet-bar-filters">
        <FilterSelect
          label="Type"
          compact
          value={filters.type}
          onChange={(v) => onChange({ type: v as OpportunityFilters["type"] })}
          options={[
            { value: "", label: "All types" },
            ...FILTER_TYPES.map((t) => ({
              value: t,
              label: oppTypeLabel(t),
              hint: oppTypeHint(t),
            })),
          ]}
        />
        <FacetTextInput
          id="opp-domain"
          label="Domain"
          value={filters.domain}
          placeholder="e.g. ML"
          onChange={(v) => onChange({ domain: v })}
        />
        <FilterSelect
          label="Stipend"
          compact
          value={filters.stipend}
          onChange={(v) => onChange({ stipend: v as OpportunityFilters["stipend"] })}
          options={[
            { value: "", label: "Any stipend" },
            { value: "true", label: "Stipend" },
            { value: "false", label: "Unpaid" },
          ]}
        />
        <FilterSelect
          label="Sort"
          compact
          value={filters.sort}
          onChange={(v) => onChange({ sort: v as OpportunitySort })}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      <div className="opp-facet-foot">
        <p className="opp-facet-count" aria-live="polite">
          {loading ? "Searching…" : `${resultCount} posting${resultCount === 1 ? "" : "s"}`}
        </p>
        {active && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
