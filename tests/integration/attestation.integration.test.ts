import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { issueAttestation } from "@/lib/services/attestation.service";
import { transitionApplication } from "@/lib/services/application.service";
import { makeUser, makeSkill, makeOpportunity, makeApplication, claimSkill } from "./helpers";
import type { Principal } from "@/lib/iam/policy";

function asPrincipal(user: { id: string; role: string; status: string }): Principal {
  return { userId: user.id, role: user.role as Principal["role"], status: user.status as Principal["status"] };
}

/**
 * IT-03 (docs/ImplementationPlan.md): attempt an attestation without a
 * SELECTED application → refused, and the refusal holds even if the service
 * layer is bypassed entirely - the DB constraint trigger
 * (attestations_require_selected, migration 20260906000000_attestations) is
 * the actual authority, not just attestation.service.ts's own check.
 */
describe("Attestation SELECTED gate (IT-03)", () => {
  it("the service refuses an attestation before SELECTED (422 domain rule)", async () => {
    const faculty = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const skill = await makeSkill();
    const opp = await makeOpportunity(faculty.id);
    const app = await makeApplication(opp.id, student.id, "APPLIED");
    await claimSkill(student.id, skill.id);

    await expect(
      issueAttestation(asPrincipal(faculty), app.id, { skillId: skill.id, context: "too early" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("the DB constraint trigger rejects a direct insert against a non-SELECTED application, bypassing the service entirely", async () => {
    const faculty = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const skill = await makeSkill();
    const opp = await makeOpportunity(faculty.id);
    const app = await makeApplication(opp.id, student.id, "SHORTLISTED");

    await expect(
      prisma.attestation.create({
        data: { applicationId: app.id, skillId: skill.id, issuerId: faculty.id, context: "bypassing the service" },
      }),
    ).rejects.toThrow(/ATTESTATION_REQUIRES_SELECTION/);
  });

  it("succeeds once the application is SELECTED, and survives a later withdrawal", async () => {
    const faculty = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const skill = await makeSkill();
    const opp = await makeOpportunity(faculty.id, { seatCount: 1 });
    const app = await makeApplication(opp.id, student.id, "APPLIED");
    await claimSkill(student.id, skill.id);

    const facultyPrincipal = asPrincipal(faculty);
    await transitionApplication(facultyPrincipal, app.id, { toState: "SHORTLISTED" });
    await transitionApplication(facultyPrincipal, app.id, { toState: "SELECTED" });

    const attestation = await issueAttestation(facultyPrincipal, app.id, {
      skillId: skill.id,
      context: "verified for real",
    });
    expect(attestation.skillId).toBe(skill.id);

    // A SELECTED offer can still be declined later (WITHDRAWN) even with an
    // attestation attached - the trigger only gates the moment of insertion,
    // unlike the composite-FK-to-a-redundant-status-column trick the original
    // plan considered and rejected for exactly this reason.
    const studentPrincipal = asPrincipal(student);
    const { withdrawApplication } = await import("@/lib/services/application.service");
    const withdrawn = await withdrawApplication(studentPrincipal, app.id);
    expect(withdrawn.status).toBe("WITHDRAWN");

    const stillThere = await prisma.attestation.findUnique({ where: { id: attestation.id } });
    expect(stillThere).not.toBeNull();
  });

  it("rejects a duplicate attestation for the same engagement + skill (409)", async () => {
    const faculty = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const skill = await makeSkill();
    const opp = await makeOpportunity(faculty.id);
    const app = await makeApplication(opp.id, student.id, "SELECTED");
    await claimSkill(student.id, skill.id);

    const principal = asPrincipal(faculty);
    await issueAttestation(principal, app.id, { skillId: skill.id, context: "first" });
    await expect(
      issueAttestation(principal, app.id, { skillId: skill.id, context: "second" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a skill the student has not claimed on their profile", async () => {
    const faculty = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const skill = await makeSkill(); // never claimed
    const opp = await makeOpportunity(faculty.id);
    const app = await makeApplication(opp.id, student.id, "SELECTED");

    await expect(
      issueAttestation(asPrincipal(faculty), app.id, { skillId: skill.id, context: "not claimed" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
