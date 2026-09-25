import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { makeOpportunity, makeUser } from "./helpers";
import { sweepSlaBreaches } from "@/lib/services/opportunity.service";
import { transitionApplication } from "@/lib/services/application.service";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * AT_RISK is a live signal, not a scar: a posting leaves it as soon as no
 * applicant is waiting past the SLA window (CONTEXT.md "At-risk posting").
 */

const H = 3_600_000;

async function overdueApplication(opportunityId: string) {
  const student = await makeUser("STUDENT");
  return prisma.application.create({
    data: {
      opportunityId,
      studentId: student.id,
      status: "APPLIED",
      appliedAt: new Date(Date.now() - 72 * H), // past the H48 pledge
    },
  });
}

async function statusOf(id: string) {
  return (await prisma.opportunity.findUniqueOrThrow({ where: { id } })).status;
}

describe("at-risk recovery", () => {
  it("the sweep returns an AT_RISK posting to LIVE once nobody is overdue", async () => {
    const poster = await makeUser("FACULTY");
    const opp = await makeOpportunity(poster.id, { status: "AT_RISK" });

    await sweepSlaBreaches();

    expect(await statusOf(opp.id)).toBe("LIVE");
  });

  it("the sweep leaves a posting AT_RISK while an applicant is still overdue", async () => {
    const poster = await makeUser("FACULTY");
    const opp = await makeOpportunity(poster.id);
    await overdueApplication(opp.id);

    await sweepSlaBreaches();
    expect(await statusOf(opp.id)).toBe("AT_RISK");
    await sweepSlaBreaches();
    expect(await statusOf(opp.id)).toBe("AT_RISK");
  });

  it("acknowledging the last overdue applicant clears AT_RISK immediately", async () => {
    const poster = await makeUser("FACULTY");
    const opp = await makeOpportunity(poster.id);
    const first = await overdueApplication(opp.id);
    const second = await overdueApplication(opp.id);
    await sweepSlaBreaches();
    const principal = { userId: poster.id, role: poster.role, status: poster.status };

    await transitionApplication(principal, first.id, { toState: "SHORTLISTED" });
    expect(await statusOf(opp.id)).toBe("AT_RISK");

    await transitionApplication(principal, second.id, { toState: "REJECTED", rejectionCode: "OTHER" });
    expect(await statusOf(opp.id)).toBe("LIVE");
  });

  it("does not revive a posting that was closed while at risk", async () => {
    const poster = await makeUser("FACULTY");
    const opp = await makeOpportunity(poster.id, { status: "CLOSED" });

    await sweepSlaBreaches();

    expect(await statusOf(opp.id)).toBe("CLOSED");
  });
});
