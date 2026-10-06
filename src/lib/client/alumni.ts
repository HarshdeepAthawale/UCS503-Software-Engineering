import type { AlumniClaim } from "@/lib/client/api";

/** Where an alumnus is in verification: what the /alumni page should show. */
export type ClaimStage = "form" | "review" | "rejected" | "approved";

export function claimStage(claim: AlumniClaim | null): ClaimStage {
  if (!claim) return "form";
  if (claim.decision === "APPROVED") return "approved";
  if (claim.decision === "REJECTED") return "rejected";
  return "review";
}
