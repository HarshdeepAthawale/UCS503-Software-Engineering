import type { TaxonomySkill } from "@/lib/client/api";

/** Integration/E2E fixture rows that leaked into shared databases. */
export function isFixtureSkillName(name: string): boolean {
  return (
    /^Skill \d/i.test(name) ||
    /\be2e\b/i.test(name) ||
    /\d{10,}/.test(name)
  );
}

/** One row per logical skill name — drops fixture noise and duplicate e2e variants. */
export function cleanTaxonomySkills(skills: TaxonomySkill[]): TaxonomySkill[] {
  const map = new Map<string, TaxonomySkill>();
  for (const skill of skills) {
    if (isFixtureSkillName(skill.name)) continue;
    const key = skill.name
      .replace(/\s*\(e2e\)\s*/i, "")
      .replace(/\s+e2e\s+\d+/i, "")
      .trim()
      .toLowerCase();
    const existing = map.get(key);
    if (!existing || skill.name.length < existing.name.length) {
      map.set(key, skill);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
  );
}
