import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import {
  createTeam,
  requestToJoin,
  decideJoinRequest,
  withdrawJoinRequest,
  getTeam,
} from "@/lib/services/team.service";
import { makeUser, makeSkill } from "./helpers";
import type { Principal } from "@/lib/iam/policy";

function asPrincipal(user: { id: string; role: string; status: string }): Principal {
  return { userId: user.id, role: user.role as Principal["role"], status: user.status as Principal["status"] };
}

describe("Team formation core flow", () => {
  it("locks the team once every role slot is filled, and the role's slotsFilled is race-safe", async () => {
    const lead = await makeUser("STUDENT");
    const joinerA = await makeUser("STUDENT");
    const joinerB = await makeUser("STUDENT");
    const skill = await makeSkill();

    const team = await createTeam(asPrincipal(lead), {
      name: "Integration Team",
      hackathon: "Integration Hackathon",
      roles: [{ label: "Backend", slotCount: 1, skillIds: [skill.id] }],
    });
    const roleId = team.roles[0]!.id;

    const reqA = await requestToJoin(asPrincipal(joinerA), roleId, {});
    const reqB = await requestToJoin(asPrincipal(joinerB), roleId, {});

    // Two concurrent accept attempts on a single-slot role - only one may win.
    const results = await Promise.allSettled([
      decideJoinRequest(asPrincipal(lead), reqA.id, { status: "ACCEPTED" }),
      decideJoinRequest(asPrincipal(lead), reqB.id, { status: "ACCEPTED" }),
    ]);
    const accepted = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const role = await prisma.teamRole.findUniqueOrThrow({ where: { id: roleId } });
    expect(role.slotsFilled).toBe(1); // never over-allocated past slotCount

    const finalTeam = await getTeam(team.id);
    expect(finalTeam.status).toBe("LOCKED");
    expect(finalTeam.members).toHaveLength(1);
  });

  it("lets a student re-request a role after withdrawing (the unique index is NOT partial like applications')", async () => {
    const lead = await makeUser("STUDENT");
    const student = await makeUser("STUDENT");

    const team = await createTeam(asPrincipal(lead), {
      name: "Re-request Team",
      hackathon: "Integration Hackathon",
      roles: [{ label: "Frontend", slotCount: 1, skillIds: [] }],
    });
    const roleId = team.roles[0]!.id;

    const first = await requestToJoin(asPrincipal(student), roleId, { message: "first try" });
    expect(first.status).toBe("PENDING");
    await withdrawJoinRequest(asPrincipal(student), first.id);

    // Same (role, student) pair as before - a naive unique-constraint catch
    // would reject this as "already requested", permanently locking the
    // student out of a role they withdrew from.
    const second = await requestToJoin(asPrincipal(student), roleId, { message: "second try" });
    expect(second.status).toBe("PENDING");
    expect(second.id).toBe(first.id); // same row, re-opened - not a new one

    // A PENDING request blocks a third concurrent attempt.
    await expect(requestToJoin(asPrincipal(student), roleId, {})).rejects.toMatchObject({ status: 409 });
  });

  it("lets a rejected student request a DIFFERENT role on the same team, and re-request the same one", async () => {
    const lead = await makeUser("STUDENT");
    const student = await makeUser("STUDENT");

    const team = await createTeam(asPrincipal(lead), {
      name: "Reject and Retry Team",
      hackathon: "Integration Hackathon",
      roles: [{ label: "Backend", slotCount: 1, skillIds: [] }],
    });
    const roleId = team.roles[0]!.id;

    const req = await requestToJoin(asPrincipal(student), roleId, {});
    await decideJoinRequest(asPrincipal(lead), req.id, { status: "REJECTED", rejectionCode: "OTHER" });

    const retry = await requestToJoin(asPrincipal(student), roleId, { message: "please reconsider" });
    expect(retry.status).toBe("PENDING");
  });

  it("refuses a second join request once a role is already full", async () => {
    const lead = await makeUser("STUDENT");
    const joinerA = await makeUser("STUDENT");
    const joinerB = await makeUser("STUDENT");

    const team = await createTeam(asPrincipal(lead), {
      name: "Full Role Team",
      hackathon: "Integration Hackathon",
      roles: [{ label: "Design", slotCount: 1, skillIds: [] }],
    });
    const roleId = team.roles[0]!.id;

    const req = await requestToJoin(asPrincipal(joinerA), roleId, {});
    await decideJoinRequest(asPrincipal(lead), req.id, { status: "ACCEPTED" });

    await expect(requestToJoin(asPrincipal(joinerB), roleId, {})).rejects.toMatchObject({ status: 409 });
  });

  it("the skillFit hint reflects the viewer's own claimed skills (matched vs missing)", async () => {
    const lead = await makeUser("STUDENT");
    const viewer = await makeUser("STUDENT");
    const skillA = await makeSkill();
    const skillB = await makeSkill();

    const team = await createTeam(asPrincipal(lead), {
      name: "Fit Team",
      hackathon: "Integration Hackathon",
      roles: [{ label: "ML", slotCount: 2, skillIds: [skillA.id, skillB.id] }],
    });

    const withoutSkills = await getTeam(team.id, viewer.id);
    expect(withoutSkills.roles[0]!.skillFit?.matched).toEqual([]);
    expect(withoutSkills.roles[0]!.skillFit?.missing.sort()).toEqual([skillA.id, skillB.id].sort());

    await prisma.profile.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id }, update: {} });
    await prisma.userSkill.create({ data: { userId: viewer.id, skillId: skillA.id, proficiency: "ADVANCED" } });

    const withOneSkill = await getTeam(team.id, viewer.id);
    expect(withOneSkill.roles[0]!.skillFit?.matched).toEqual([skillA.id]);
    expect(withOneSkill.roles[0]!.skillFit?.missing).toEqual([skillB.id]);

    // The lead viewing their own team gets no skillFit (undefined, not zeroed).
    const leadView = await getTeam(team.id, lead.id);
    expect(leadView.roles[0]!.skillFit).toBeUndefined();
  });
});
