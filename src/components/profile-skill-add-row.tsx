"use client";

import { FormSelect } from "@/components/form-select";

export const PROFICIENCIES = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
] as const;

export type Proficiency = (typeof PROFICIENCIES)[number];

const PROFICIENCY_OPTIONS = PROFICIENCIES.map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

type ProfileSkillAddRowProps = {
  name: string;
  proficiency: Proficiency;
  suggestions: { id: string; name: string }[];
  atLimit: boolean;
  limit: number;
  onNameChange: (name: string) => void;
  onProficiencyChange: (proficiency: Proficiency) => void;
  onAdd: () => void;
};

/** Profile skills row — text input + proficiency picker + Add, all one height. */
export function ProfileSkillAddRow({
  name,
  proficiency,
  suggestions,
  atLimit,
  limit,
  onNameChange,
  onProficiencyChange,
  onAdd,
}: ProfileSkillAddRowProps) {
  const canAdd = name.trim().length > 0 && !atLimit;

  return (
    <div className="skill-add-row">
      <div className="skill-add-field skill-add-field-grow">
        <input
          type="text"
          className="skill-add-input"
          list="skill-suggestions"
          aria-label="Skill name"
          placeholder={atLimit ? `Limit of ${limit} reached` : "Type a skill…"}
          value={name}
          maxLength={80}
          disabled={atLimit}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canAdd) onAdd();
            }
          }}
        />
        <datalist id="skill-suggestions">
          {suggestions.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </div>
      <div className="skill-add-field skill-add-field-proficiency">
        <FormSelect
          id="skill-proficiency"
          value={proficiency}
          options={PROFICIENCY_OPTIONS}
          onChange={(v) => onProficiencyChange(v as Proficiency)}
          searchable={false}
          disabled={atLimit}
          compact
        />
      </div>
      <button
        className="mini solid skill-add-btn"
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
      >
        Add
      </button>
    </div>
  );
}
