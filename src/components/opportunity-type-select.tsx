"use client";

import { useMemo } from "react";
import type { OppType } from "@/lib/client/api";
import { oppTypeHint, oppTypeLabel, POSTING_OPP_TYPES } from "@/lib/client/format";
import { FormSelect, type FormSelectOption } from "@/components/form-select";

function buildOptions(includeAll: boolean, types: readonly string[]): FormSelectOption[] {
  const opts: FormSelectOption[] = includeAll
    ? [{ value: "", label: "All types", hint: "Show every posting type" }]
    : [];

  for (const t of types) {
    opts.push({
      value: t,
      label: oppTypeLabel(t),
      hint: oppTypeHint(t),
    });
  }
  return opts;
}

/** Searchable opportunity-type picker for forms and filters. */
export function OpportunityTypeSelect({
  id,
  value,
  onChange,
  includeAll = false,
  /** Filter bar uses posting types only; set false to include legacy hackathon postings. */
  postingTypesOnly = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  postingTypesOnly?: boolean;
}) {
  const types = postingTypesOnly ? POSTING_OPP_TYPES : [...POSTING_OPP_TYPES, "HACKATHON_TEAM"];
  const options = useMemo(() => buildOptions(includeAll, types), [includeAll, postingTypesOnly]);

  return (
    <FormSelect
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={includeAll ? "All types" : "Select type"}
      searchable={options.length > 6}
    />
  );
}

/** Compact type filter for the opportunities facet bar. */
export function OpportunityTypeFilter({
  value,
  onChange,
}: {
  value: "" | OppType;
  onChange: (value: "" | OppType) => void;
}) {
  const options = useMemo(
    () => buildOptions(true, [...POSTING_OPP_TYPES, "HACKATHON_TEAM"]),
    [],
  );

  return (
    <FormSelect
      id="opp-type-filter"
      value={value}
      options={options}
      onChange={(v) => onChange(v as "" | OppType)}
      placeholder="All types"
      searchable
    />
  );
}
