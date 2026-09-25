import type { Applicant, AppState, RejectionCode } from "@/lib/client/api";
import { REJECTION_REASONS } from "@/lib/client/format";

/** A move a poster can make (mirrors POSTER_TRANSITIONS in application-state.ts). */
export type PosterMove = Exclude<AppState, "APPLIED" | "WITHDRAWN" | "RECEIVED">;
export type Stage = AppState | "ALL";
export type ApplicantSort = "applied_desc" | "applied_asc" | "cgpa_desc" | "name_asc";

export const STAGE_TABS: { value: Stage; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "APPLIED", label: "New" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "SELECTED", label: "Selected" },
  { value: "REJECTED", label: "Not selected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export const SORT_OPTIONS: { value: ApplicantSort; label: string }[] = [
  { value: "applied_desc", label: "Newest first" },
  { value: "applied_asc", label: "Oldest first" },
  { value: "cgpa_desc", label: "Highest CGPA" },
  { value: "name_asc", label: "Name A–Z" },
];

export const MOVE_LABEL: Record<PosterMove, string> = {
  SHORTLISTED: "Shortlist",
  INTERVIEW: "Move to interview",
  SELECTED: "Select",
  REJECTED: "Not selected",
};

/** New applications skip RECEIVED, but a legacy RECEIVED row is still new to the poster. */
function stageOf(status: AppState): AppState {
  return status === "RECEIVED" ? "APPLIED" : status;
}

export function stageCounts(list: Applicant[]): Map<Stage, number> {
  const m = new Map<Stage, number>([["ALL", list.length]]);
  for (const a of list) m.set(stageOf(a.status), (m.get(stageOf(a.status)) ?? 0) + 1);
  return m;
}

export function filterApplicants(
  list: Applicant[],
  f: { stage: Stage; q: string; minCgpa: string; sort: ApplicantSort },
): Applicant[] {
  const floor = f.minCgpa.trim() === "" ? null : Number(f.minCgpa);
  const q = f.q.trim().toLowerCase();
  const out = list.filter(
    (a) =>
      (f.stage === "ALL" || stageOf(a.status) === f.stage) &&
      (floor == null || Number.isNaN(floor) || (a.student.cgpa != null && a.student.cgpa >= floor)) &&
      (!q || a.student.name.toLowerCase().includes(q)),
  );
  const at = (a: Applicant) => new Date(a.appliedAt).getTime();
  switch (f.sort) {
    case "applied_asc":
      return out.sort((a, b) => at(a) - at(b));
    case "cgpa_desc":
      return out.sort((a, b) => (b.student.cgpa ?? -1) - (a.student.cgpa ?? -1));
    case "name_asc":
      return out.sort((a, b) => a.student.name.localeCompare(b.student.name));
    default:
      return out.sort((a, b) => at(b) - at(a));
  }
}

/** The obvious next move gets the primary button; reject is always kept apart. */
export function nextSteps(status: AppState): { primary: PosterMove | null; others: PosterMove[]; canReject: boolean } {
  switch (status) {
    case "APPLIED":
    case "RECEIVED":
      return { primary: "SHORTLISTED", others: [], canReject: true };
    case "SHORTLISTED":
      return { primary: "INTERVIEW", others: ["SELECTED"], canReject: true };
    case "INTERVIEW":
      return { primary: "SELECTED", others: [], canReject: true };
    default:
      return { primary: null, others: [], canReject: false };
  }
}

export function rejectionLabel(code: RejectionCode): string {
  return REJECTION_REASONS.find((r) => r.value === code)?.label ?? code;
}
