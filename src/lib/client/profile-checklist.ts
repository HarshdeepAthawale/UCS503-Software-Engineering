import type { SessionUser } from "@/lib/client/api";

/**
 * Profile completeness: the short list of steps that make a profile useful to
 * the people reading it. Students are read by posters deciding whom to
 * shortlist, and their eligibility fields drive posting filters; faculty and
 * alumni are read by students deciding whether to apply. Each item names the
 * profile section that completes it, so the checklist can link straight there.
 */

export interface ChecklistInput {
  headline: string;
  bio: string;
  branch: string;
  year: string;
  cgpa: string;
  skillCount: number;
  openToCount: number;
  hasResume: boolean;
  hasLink: boolean;
  projectCount: number;
}

export type ProfileSection = "basics" | "academics" | "availability" | "skills" | "links" | "resume" | "projects";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  section: ProfileSection;
}

/** Posters want enough skills to judge fit; one or two says little. */
export const MIN_SKILLS = 3;

export function profileChecklist(
  role: SessionUser["role"],
  p: ChecklistInput,
): { items: ChecklistItem[]; percent: number } {
  const filled = (v: string) => v.trim().length > 0;
  const student = role === "STUDENT";

  const items: ChecklistItem[] = [
    { key: "headline", label: "Add a one-line headline", done: filled(p.headline), section: "basics" },
    { key: "bio", label: "Write a short bio", done: filled(p.bio), section: "basics" },
    ...(student
      ? [
          {
            key: "academics",
            label: "Add branch, year and CGPA",
            done: filled(p.branch) && filled(p.year) && filled(p.cgpa),
            section: "academics" as const,
          },
        ]
      : []),
    { key: "skills", label: `List at least ${MIN_SKILLS} skills`, done: p.skillCount >= MIN_SKILLS, section: "skills" },
    ...(student
      ? [
          { key: "availability", label: "Say what you're open to", done: p.openToCount > 0, section: "availability" as const },
          { key: "resume", label: "Upload your résumé", done: p.hasResume, section: "resume" as const },
        ]
      : []),
    {
      key: "work",
      label: "Add a link or a project",
      done: p.hasLink || p.projectCount > 0,
      section: p.hasLink ? "projects" : "links",
    },
  ];

  const done = items.filter((i) => i.done).length;
  return { items, percent: Math.round((done / items.length) * 100) };
}
