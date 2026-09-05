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

/** Short descriptions shown in the profile branch picker. */
export const BRANCH_HINTS: Record<Branch, string> = {
  COE: "Computer Engineering",
  ENC: "Electronics & Computer Engineering",
  ECE: "Electronics & Communication Engineering",
  ELECTRICAL: "Electrical Engineering",
  MECHANICAL: "Mechanical Engineering",
  MECHATRONICS: "Mechatronics Engineering",
  CIVIL: "Civil Engineering",
  CCA: "Computer Science & Applications",
  EIC: "Electronics Instrumentation & Control",
  BIOTECH: "Biotechnology",
  BIOMED: "Biomedical Engineering",
  COPC: "Chemical & Pharmaceutical Sciences",
  COBS: "Commerce & Business Studies",
  RAI: "Robotics & Artificial Intelligence",
  EVD: "Electric Vehicle Design",
};

export function isBranch(v: string): v is Branch {
  return (BRANCHES as readonly string[]).includes(v);
}
