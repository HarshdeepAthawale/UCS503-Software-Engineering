import { describe, it, expect, vi } from "vitest";
import { makeOpportunity, makeUser } from "./helpers";
import {
  applyToOpportunity,
  listMyApplications,
  transitionApplication,
  withdrawApplication,
} from "@/lib/services/application.service";
import { env } from "@/lib/env";
import type { Principal } from "@/lib/iam/policy";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * The student's application tracker needs, per application, its full dated
 * timeline, the poster, and the reply window they promised - plus how much of
 * the application budget is in use.
 */

const as = (u: { id: string; role: Principal["role"] }): Principal => ({ userId: u.id, role: u.role, status: "ACTIVE" });

describe("listMyApplications", () => {
  it("returns each application's timeline, poster and promised reply window", async () => {
    const poster = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const opp = await makeOpportunity(poster.id, { slaPledge: "H24" });

    const app = await applyToOpportunity(as(student), opp.id, {});
    await transitionApplication(as(poster), app.id, { toState: "SHORTLISTED" });

    const { applications } = await listMyApplications(as(student));
    const mine = applications.find((a) => a.id === app.id)!;

    expect(mine.opportunity.slaPledge).toBe("H24");
    expect(mine.opportunity.poster.name).toBe(poster.name);
    expect(mine.events.map((e) => e.toState)).toEqual(["APPLIED", "SHORTLISTED"]);
    expect(new Date(mine.events[1]!.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(mine.events[0]!.createdAt).getTime());
  });

  it("reports the application budget in use (withdrawn ones free a slot)", async () => {
    const poster = await makeUser("FACULTY");
    const student = await makeUser("STUDENT");
    const [a, b] = await Promise.all([makeOpportunity(poster.id), makeOpportunity(poster.id)]);
    await applyToOpportunity(as(student), a.id, {});
    const second = await applyToOpportunity(as(student), b.id, {});
    await withdrawApplication(as(student), second.id);

    const { budget } = await listMyApplications(as(student));
    expect(budget).toEqual({ active: 1, limit: env.APPLICATION_BUDGET });
  });
});
