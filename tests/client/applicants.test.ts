import { describe, expect, it } from "vitest";
import type { Applicant, AppState } from "@/lib/client/api";
import { filterApplicants, nextSteps, rejectionLabel, stageCounts } from "@/lib/client/applicants";

function applicant(
  name: string,
  status: AppState,
  appliedAt: string,
  cgpa: number | null = null,
): Applicant {
  return {
    id: name,
    status,
    appliedAt,
    firstTransitionAt: null,
    rejectionCode: null,
    student: { id: `s-${name}`, name, branch: "COE", cgpa, backlogs: 0, skills: [] },
    events: [],
  };
}

const list = [
  applicant("Palak", "SHORTLISTED", "2026-09-20T00:00:00Z", 5.45),
  applicant("Aman", "APPLIED", "2026-09-24T00:00:00Z", 8.2),
  applicant("Rhea", "RECEIVED", "2026-09-10T00:00:00Z", 9.1),
  applicant("Kabir", "REJECTED", "2026-09-22T00:00:00Z", null),
];

describe("filterApplicants", () => {
  it("counts a legacy RECEIVED application as new, so it is never hidden from the poster", () => {
    const names = filterApplicants(list, { stage: "APPLIED", q: "", minCgpa: "", sort: "applied_desc" }).map((a) => a.student.name);
    expect(names).toEqual(["Aman", "Rhea"]);
    expect(stageCounts(list).get("APPLIED")).toBe(2);
    expect(stageCounts(list).get("ALL")).toBe(4);
  });

  it("filters by name and CGPA floor, dropping unknown CGPA once a floor is set", () => {
    const names = filterApplicants(list, { stage: "ALL", q: "", minCgpa: "8", sort: "cgpa_desc" }).map((a) => a.student.name);
    expect(names).toEqual(["Rhea", "Aman"]);
    expect(filterApplicants(list, { stage: "ALL", q: "pal", minCgpa: "", sort: "applied_desc" })).toHaveLength(1);
  });

  it("sorts newest first by default", () => {
    const names = filterApplicants(list, { stage: "ALL", q: "", minCgpa: "", sort: "applied_desc" }).map((a) => a.student.name);
    expect(names).toEqual(["Aman", "Kabir", "Palak", "Rhea"]);
  });
});

describe("nextSteps", () => {
  it("offers one obvious next move, the other forward moves, and reject separately", () => {
    expect(nextSteps("APPLIED")).toEqual({ primary: "SHORTLISTED", others: [], canReject: true });
    expect(nextSteps("SHORTLISTED")).toEqual({ primary: "INTERVIEW", others: ["SELECTED"], canReject: true });
    expect(nextSteps("INTERVIEW")).toEqual({ primary: "SELECTED", others: [], canReject: true });
    expect(nextSteps("SELECTED")).toEqual({ primary: null, others: [], canReject: false });
  });
});

describe("rejectionLabel", () => {
  it("uses the reason's wording", () => {
    expect(rejectionLabel("SEATS_FILLED")).toBe("Seats filled");
  });
});
