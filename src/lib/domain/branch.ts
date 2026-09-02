/**
 * Institute branch vocabulary (docs/PRD M3 eligibility filters). A fixed list
 * rather than free text, mirroring the Skill taxonomy rationale: a poster's
 * `eligibleBranches` and a student's `Profile.branch` must draw on the SAME
 * codes or matching one against the other is meaningless.
 *
 * Stored as plain text (`profiles.branch`, `opportunities.eligible_branches`)
 * rather than a DB enum, so tightening this list never requires a migration -
 * only this array changes.
 */
export const BRANCHES = [
  "COE",
  "ENC",
  "ECE",
  "ELECTRICAL",
  "MECHANICAL",
  "MECHATRONICS",
  "CIVIL",
  "CCA",
  "EIC",
  "BIOTECH",
  "BIOMED",
  "COPC",
  "COBS",
  "RAI",
  "EVD",
] as const;

export type Branch = (typeof BRANCHES)[number];

export function isBranch(v: string): v is Branch {
  return (BRANCHES as readonly string[]).includes(v);
}
