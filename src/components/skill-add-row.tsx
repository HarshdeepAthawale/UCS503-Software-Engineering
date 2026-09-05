"use client";

import { useMemo } from "react";
import { FormSelect } from "@/components/form-select";
import type { SkillRequirement, TaxonomySkill } from "@/lib/client/api";

const REQUIREMENT_OPTIONS = [
  { value: "REQUIRED", label: "Required", hint: "Applicant must have this skill" },
  { value: "PREFERRED", label: "Preferred", hint: "Nice to have — not mandatory" },
] as const;

export function SkillAddRow({
  available,
  pick,
  pickReq,
  onPickChange,
  onPickReqChange,
  onAdd,
}: {
  available: TaxonomySkill[];
  pick: string;
  pickReq: SkillRequirement;
  onPickChange: (skillId: string) => void;
  onPickReqChange: (req: SkillRequirement) => void;
  onAdd: () => void;
}) {
  const skillOptions = useMemo(
    () => [
      { value: "", label: "Choose a skill…", hint: "Search by name or domain" },
      ...available.map((s) => ({
        value: s.id,
        label: s.name,
        hint: s.domain,
        group: s.domain,
      })),
    ],
    [available],
  );

  return (
    <div className="skill-add-row">
      <div className="skill-add-field skill-add-field-grow">
        <FormSelect
          id="skill-pick"
          value={pick}
          options={skillOptions}
          onChange={onPickChange}
          placeholder="Choose a skill…"
          searchable
          compact
        />
      </div>
      <div className="skill-add-field skill-add-field-req">
        <FormSelect
          id="skill-req"
          value={pickReq}
          options={[...REQUIREMENT_OPTIONS]}
          onChange={(v) => onPickReqChange(v as SkillRequirement)}
          placeholder="Requirement"
          searchable={false}
          compact
        />
      </div>
      <button className="mini solid" type="button" onClick={onAdd} disabled={!pick}>
        Add
      </button>
    </div>
  );
}
