"use client";

import { useMemo } from "react";
import { BRANCH_GROUPS, BRANCH_HINTS, BRANCHES, isBranch } from "@/lib/domain/branch";
import { FormSelect, type FormSelectOption } from "@/components/form-select";

function buildOptions(legacy?: string | null): FormSelectOption[] {
  const opts: FormSelectOption[] = [
    { value: "", label: "Not set", hint: "Open to any branch-restricted posting" },
  ];

  if (legacy && !isBranch(legacy)) {
    opts.push({
      value: legacy,
      label: legacy,
      hint: "Legacy value — pick a branch below",
    });
  }

  for (const group of BRANCH_GROUPS) {
    for (const code of group.codes) {
      opts.push({
        value: code,
        label: code,
        hint: BRANCH_HINTS[code],
        group: group.label,
      });
    }
  }

  // Any branch missing from groups (shouldn't happen) still appears.
  for (const code of BRANCHES) {
    if (!opts.some((o) => o.value === code)) {
      opts.push({ value: code, label: code, hint: BRANCH_HINTS[code] });
    }
  }

  return opts;
}

/** Searchable, grouped branch picker for the profile form. */
export function BranchSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = useMemo(() => buildOptions(value), [value]);

  return (
    <FormSelect
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Select your branch"
      searchable
    />
  );
}
