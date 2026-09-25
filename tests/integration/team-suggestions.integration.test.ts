import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam, teamSuggestions } from "@/lib/services/team.service";
import { makeUser } from "./helpers";
import type { Principal } from "@/lib/iam/policy";

/**
 * Hackathon and role suggestions come from what teams actually use - not a
 * hardcoded list that goes stale. The shared test database keeps rows between
 * runs, so every name here carries a unique token and the limit is generous.
 */

const principal = (u: { id: string }): Principal => ({ userId: u.id, role: "STUDENT", status: "ACTIVE" });
const LIMIT = 1000;

async function team(hackathon: string, roles: string[]) {
  const lead = await makeUser("STUDENT");
  return createTeam(principal(lead), {
    name: `Suggest ${randomUUID()}`,
    hackathon,
    roles: roles.map((label) => ({ label, slotCount: 1, skillIds: [] })),
  });
}

describe("teamSuggestions", () => {
  it("groups hackathon names case-insensitively and counts recruiting teams", async () => {
    const token = randomUUID().slice(0, 8);
    await team(`Hack ${token}`, ["Backend"]);
    await team(`hack ${token}`, ["Frontend"]);
    await team(`HACK ${token} `, ["Design"]);

    const { hackathons } = await teamSuggestions(LIMIT);
    const mine = hackathons.filter((h) => h.name.trim().toLowerCase() === `hack ${token}`);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.teams).toBe(3);
  });

  it("leaves out hackathons with no team still recruiting", async () => {
    const name = `Closed ${randomUUID().slice(0, 8)}`;
    const t = await team(name, ["Backend"]);
    await prisma.team.update({ where: { id: t.id }, data: { status: "CLOSED" } });

    const { hackathons } = await teamSuggestions(LIMIT);
    expect(hackathons.map((h) => h.name)).not.toContain(name);
  });

  it("suggests role names by how many teams use them", async () => {
    const token = randomUUID().slice(0, 8);
    await team(`Roles ${token}`, [`Common ${token}`, `Rare ${token}`]);
    await team(`Roles ${token}`, [`common ${token}`]);

    const { roles } = await teamSuggestions(LIMIT);
    const common = roles.find((r) => r.label.toLowerCase() === `common ${token}`);
    const rare = roles.find((r) => r.label === `Rare ${token}`);
    expect(common?.uses).toBe(2);
    expect(rare?.uses).toBe(1);
    expect(roles.indexOf(common!)).toBeLessThan(roles.indexOf(rare!));
  });
});
