import { describe, it, expect } from "vitest";
import { claimStage } from "@/lib/client/alumni";
import type { AlumniClaim } from "@/lib/client/api";

const claim = (decision: AlumniClaim["decision"]): AlumniClaim => ({
  id: "c", rollNo: "101", gradYear: 2019, degree: "B.E.", proofUrl: "https://x.test", decision,
  decisionReason: decision === "REJECTED" ? "Unreadable" : null, createdAt: "", updatedAt: "",
});

describe("claimStage", () => {
  it("asks for proof first, then shows review, rejection or approval", () => {
    expect(claimStage(null)).toBe("form");
    expect(claimStage(claim(null))).toBe("review");
    expect(claimStage(claim("REJECTED"))).toBe("rejected");
    expect(claimStage(claim("APPROVED"))).toBe("approved");
  });
});
