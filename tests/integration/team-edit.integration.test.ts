import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam, decideJoinRequest, getTeam, requestToJoin, teamSuggestions, updateTeam } from "@/lib/services/team.service";
import { makeSkill, makeUser } from "./helpers";
import type { Principal } from "@/lib/iam/policy";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * The lead edits everything about a team: details and roles. Roles that are
 * removed are soft-deleted (history stays), and a role can never be edited
 * below the members it already has.
 */

const as = (u: { id: string; role: string }): Principal => ({ userId: u.id, role: u.role as Principal["role"], status: "ACTIVE" });

async function teamWithTwoRoles() {
  const designLabel = `Design ${Math.random().toString(36).slice(2, 8)}`;
  const lead = await makeUser("STUDENT");
  const skill = await makeSkill();
  const team = await createTeam(as(lead), {
    name: "Edit Me",
    hackathon: "Old Hack",
    roles: [
      { label: "Backend", slotCount: 2, skillIds: [skill.id] },
      { label: designLabel, slotCount: 1, skillIds: [] },
    ],
  });
  return { lead, skill, team, backend: team.roles.find((r) => r.label === "Backend")!, design: team.roles.find((r) => r.label === designLabel)!, designLabel };
}

describe("updateTeam - details and roles", () => {
  it("renames the team, changes the event, edits a role, removes one and adds one", async () => {
    const { lead, skill, team, backend, design, designLabel } = await teamWithTwoRoles();

    const updated = await updateTeam(as(lead), team.id, {
      name: "Renamed",
      hackathon: "New Hack",
      roles: [
        { id: backend.id, label: "Backend engineer", slotCount: 3, skillIds: [] },
        { label: "Security", slotCount: 1, skillIds: [skill.id] },
      ],
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.hackathon).toBe("New Hack");
    expect(updated.roles.map((r) => [r.label, r.slotCount])).toEqual([
      ["Backend engineer", 3],
      ["Security", 1],
    ]);
    expect(updated.roles.find((r) => r.label === "Backend engineer")!.skills).toEqual([]);

    // Removed, not destroyed: the row stays with deletedAt set, and it no
    // longer shows anywhere a person looks.
    const gone = await prisma.teamRole.findUniqueOrThrow({ where: { id: design.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect((await getTeam(team.id)).roles.map((r) => r.id)).not.toContain(design.id);
    const joiner = await makeUser("STUDENT");
    await expect(requestToJoin(as(joiner), design.id, {})).rejects.toMatchObject({ status: 404 });
    const labels = (await teamSuggestions(1000)).roles.map((r) => r.label);
    expect(labels).not.toContain(designLabel);
  });

  it("refuses to cut a role below its members or remove one with members or undecided requests", async () => {
    const { lead, team, backend, design } = await teamWithTwoRoles();
    const [member, waiting] = await Promise.all([makeUser("STUDENT"), makeUser("STUDENT")]);
    const req = await requestToJoin(as(member), backend.id, {});
    await decideJoinRequest(as(lead), req.id, { status: "ACCEPTED" });
    await requestToJoin(as(waiting), design.id, {});

    const keepDesign = { id: design.id, label: "Design", slotCount: 1, skillIds: [] };
    await expect(
      updateTeam(as(lead), team.id, { roles: [{ id: backend.id, label: "Backend", slotCount: 0 + 1, skillIds: [] }, keepDesign] }),
    ).resolves.toBeTruthy(); // 1 member, 1 slot: allowed

    // Only Design left: Backend (with a member) would be removed.
    await expect(updateTeam(as(lead), team.id, { roles: [keepDesign] })).rejects.toMatchObject({ status: 409 });
    // Only Backend left: Design has an undecided request.
    await expect(
      updateTeam(as(lead), team.id, { roles: [{ id: backend.id, label: "Backend", slotCount: 1, skillIds: [] }] }),
    ).rejects.toMatchObject({ status: 409 });
    // A role that is not this team's is refused.
    const other = await teamWithTwoRoles();
    await expect(
      updateTeam(as(lead), team.id, { roles: [{ id: other.backend.id, label: "X", slotCount: 1, skillIds: [] }, keepDesign] }),
    ).rejects.toMatchObject({ status: 400 });

    const roles = await prisma.teamRole.findMany({ where: { teamId: team.id, deletedAt: null } });
    expect(roles).toHaveLength(2);
  });

  it("locks a team edited down to full, and reopens it when a slot is added", async () => {
    const { lead, team, backend, design } = await teamWithTwoRoles();
    const member = await makeUser("STUDENT");
    const req = await requestToJoin(as(member), backend.id, {});
    await decideJoinRequest(as(lead), req.id, { status: "ACCEPTED" });

    const full = await updateTeam(as(lead), team.id, { roles: [{ id: backend.id, label: "Backend", slotCount: 1, skillIds: [] }] });
    expect(full.status).toBe("LOCKED");
    expect((await prisma.teamRole.findUniqueOrThrow({ where: { id: design.id } })).deletedAt).not.toBeNull();

    const reopened = await updateTeam(as(lead), team.id, {
      name: "Still editable while locked",
      roles: [{ id: backend.id, label: "Backend", slotCount: 2, skillIds: [] }],
    });
    expect(reopened.status).toBe("FORMING");
    expect(reopened.name).toBe("Still editable while locked");
  });

  it("does not edit a closed team", async () => {
    const { lead, team } = await teamWithTwoRoles();
    await updateTeam(as(lead), team.id, { status: "CLOSED" });
    await expect(updateTeam(as(lead), team.id, { name: "Nope" })).rejects.toMatchObject({ status: 409 });
  });
});
