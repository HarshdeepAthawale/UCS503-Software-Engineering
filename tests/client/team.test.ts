import { describe, it, expect } from "vitest";
import { openRoles, slotSummary, teamStatusLabel, viewerRelation } from "@/lib/client/team";
import type { Team } from "@/lib/client/api";

/** How a team is described on the teams pages. */

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Nightowls",
    hackathon: "Hack 2026",
    description: null,
    eventDate: null,
    status: "FORMING",
    createdAt: "2026-09-01T00:00:00Z",
    lead: { id: "lead", name: "Asha" },
    roles: [
      { id: "r1", label: "Backend", slotCount: 2, slotsFilled: 1, skills: [], myRequest: null },
      { id: "r2", label: "Design", slotCount: 1, slotsFilled: 1, skills: [], myRequest: null },
    ],
    members: [{ userId: "m1", name: "Ravi", roleId: "r1" }],
    ...overrides,
  } as Team;
}

describe("teamStatusLabel", () => {
  it("never shows the raw database value", () => {
    expect(teamStatusLabel("FORMING")).toBe("Recruiting");
    expect(teamStatusLabel("LOCKED")).toBe("Team complete");
    expect(teamStatusLabel("CLOSED")).toBe("Closed");
  });
});

describe("slotSummary", () => {
  it("counts filled and open slots across roles", () => {
    expect(slotSummary(team())).toEqual({ filled: 2, total: 3, open: 1 });
  });
});

describe("openRoles", () => {
  it("lists only roles with a free slot", () => {
    expect(openRoles(team()).map((r) => r.label)).toEqual(["Backend"]);
  });
});

describe("viewerRelation", () => {
  it("names the viewer's place on the team", () => {
    expect(viewerRelation(team(), "lead")).toBe("You lead this team");
    expect(viewerRelation(team(), "m1")).toBe("You're a member");
    expect(viewerRelation(team(), "stranger")).toBeNull();
  });

  it("reports the viewer's own pending or decided request", () => {
    const t = team({
      roles: [
        { id: "r1", label: "Backend", slotCount: 2, slotsFilled: 1, skills: [], myRequest: { id: "q", status: "PENDING" } },
      ] as Team["roles"],
    });
    expect(viewerRelation(t, "stranger")).toBe("Request pending · Backend");
  });
});
