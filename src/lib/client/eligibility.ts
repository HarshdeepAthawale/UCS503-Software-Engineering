import type { Opportunity } from "@/lib/client/api";

/**
 * Whether a student meets a posting's eligibility criteria (docs/PRD M3).
 * Mirrors the authoritative check in application.service.ts - missing profile
 * data counts as not meeting a criterion - so the UI can say so up front. It is
 * a preview only; the server decides on submit.
 */

export interface EligibilityProfile {
  branch: string | null;
  cgpa: number | null;
  backlogs: number | null;
}

export interface EligibilityReason {
  /** For a card, after "Not eligible ·", e.g. "needs CGPA 8.5+". */
  short: string;
  /** For a sentence, e.g. "requires a minimum CGPA of 8.5". */
  long: string;
}

export function eligibility(
  opp: Pick<Opportunity, "eligibleBranches" | "minCgpa" | "maxBacklogs">,
  me: EligibilityProfile | null,
): { restricted: boolean; eligible: boolean; reasons: EligibilityReason[] } {
  const reasons: EligibilityReason[] = [];
  // The API serialises Decimal columns as strings ("8.10"); compare as numbers.
  const cgpa = me?.cgpa == null ? null : Number(me.cgpa);
  const minCgpa = opp.minCgpa == null ? null : Number(opp.minCgpa);

  if (opp.eligibleBranches.length > 0 && (!me?.branch || !opp.eligibleBranches.includes(me.branch))) {
    reasons.push({
      short: `for ${opp.eligibleBranches.join(", ")}`,
      long: `restricted to ${opp.eligibleBranches.join(", ")}`,
    });
  }
  if (minCgpa != null && (cgpa == null || cgpa < minCgpa)) {
    reasons.push({ short: `needs CGPA ${minCgpa}+`, long: `requires a minimum CGPA of ${minCgpa}` });
  }
  if (opp.maxBacklogs != null && (me?.backlogs == null || me.backlogs > opp.maxBacklogs)) {
    reasons.push({
      short: `max ${opp.maxBacklogs} backlogs`,
      long: `requires ${opp.maxBacklogs} or fewer active backlogs`,
    });
  }

  const restricted = opp.eligibleBranches.length > 0 || minCgpa != null || opp.maxBacklogs != null;
  return { restricted, eligible: reasons.length === 0, reasons };
}
