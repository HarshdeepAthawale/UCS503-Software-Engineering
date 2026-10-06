import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { register, verifyRegistrationOtp } from "@/lib/services/auth.service";
import { decideClaim, getMyClaim, listPendingClaims, submitClaim } from "@/lib/services/alumni.service";
import { makeUser } from "./helpers";
import type { Principal } from "@/lib/iam/policy";

const send = vi.fn();
vi.mock("@/lib/email/mailer", () => ({ mailer: { send: (...a: unknown[]) => send(...a), configured: true } }));

/**
 * Alumni self-registration (docs/PRD §4.5): an alumnus signs up with any
 * email, proves they own it, submits proof of graduation, and an admin
 * approves or rejects. Until approved the account is read-only; a rejection
 * comes with a reason and can be corrected and resubmitted.
 */

const as = (u: { id: string; role: string; status: string }): Principal => ({
  userId: u.id,
  role: u.role as Principal["role"],
  status: u.status as Principal["status"],
});

const proof = (rollNo = `10${Math.floor(Math.random() * 1e7)}`) => ({
  rollNo,
  gradYear: 2019,
  degree: "B.E. Computer Engineering",
  proofUrl: "https://example.test/degree.pdf",
});

describe("alumni registration", () => {
  it("registers with a personal email and lands in pending review once the email is verified", async () => {
    const email = `alum.${randomUUID()}@example.test`;
    const { otpForDelivery } = await register({ name: "Asha Alum", email, password: "Str0ngPassword!", role: "ALUMNI", status: "UNVERIFIED" });
    expect(otpForDelivery).toBeTruthy();

    const session = await verifyRegistrationOtp({ email, otp: otpForDelivery!, userAgent: null });
    expect(session.user.role).toBe("ALUMNI");
    expect(session.user.status).toBe("PENDING_ALUMNI");
  });
});

describe("alumni claims", () => {
  it("submits a claim, lists it for review, and approval makes the account active", async () => {
    const [alum, admin] = await Promise.all([makeUser("ALUMNI", "PENDING_ALUMNI"), makeUser("ADMIN")]);
    await submitClaim(as(alum), proof());
    await expect(submitClaim(as(alum), proof())).rejects.toMatchObject({ status: 409 }); // already under review

    const queue = await listPendingClaims();
    const mine = queue.find((c) => c.user.id === alum.id);
    expect(mine).toBeTruthy();

    send.mockClear();
    await decideClaim(as(admin), mine!.id, "APPROVED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alum.id } })).status).toBe("ACTIVE");
    expect((await getMyClaim(as({ ...alum, status: "ACTIVE" })))?.decision).toBe("APPROVED");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: alum.email }));
    // A decided claim cannot be decided twice.
    await expect(decideClaim(as(admin), mine!.id, "REJECTED", "Too late")).rejects.toMatchObject({ status: 409 });
  });

  it("a rejection keeps the account pending with a reason, and the alumnus can correct and resubmit", async () => {
    const [alum, admin] = await Promise.all([makeUser("ALUMNI", "PENDING_ALUMNI"), makeUser("ADMIN")]);
    const claim = await submitClaim(as(alum), proof());

    await expect(decideClaim(as(admin), claim.id, "REJECTED")).rejects.toMatchObject({ status: 400 }); // a reason is required
    await decideClaim(as(admin), claim.id, "REJECTED", "The certificate link does not open.");

    const after = await prisma.user.findUniqueOrThrow({ where: { id: alum.id } });
    expect(after.status).toBe("PENDING_ALUMNI"); // not suspended - they can try again
    const rejected = await getMyClaim(as(alum));
    expect(rejected).toMatchObject({ decision: "REJECTED", decisionReason: "The certificate link does not open." });

    const again = await submitClaim(as(alum), { ...proof(), proofUrl: "https://example.test/fixed.pdf" });
    expect(again.id).toBe(claim.id);
    expect(await getMyClaim(as(alum))).toMatchObject({ decision: null, decisionReason: null, proofUrl: "https://example.test/fixed.pdf" });
  });

  it("flags a roll number that another claim already uses", async () => {
    const [a, b] = await Promise.all([makeUser("ALUMNI", "PENDING_ALUMNI"), makeUser("ALUMNI", "PENDING_ALUMNI")]);
    const roll = `DUP${Math.floor(Math.random() * 1e8)}`;
    await submitClaim(as(a), proof(roll));
    await submitClaim(as(b), proof(roll));

    const queue = await listPendingClaims();
    const forB = queue.find((c) => c.user.id === b.id)!;
    expect(forB.sameRollNo.map((x) => x.userId)).toEqual([a.id]);
  });

  it("only a pending alumnus may submit a claim", async () => {
    const [student, activeAlum] = await Promise.all([makeUser("STUDENT"), makeUser("ALUMNI")]);
    await expect(submitClaim(as(student), proof())).rejects.toMatchObject({ status: 403 });
    await expect(submitClaim(as(activeAlum), proof())).rejects.toMatchObject({ status: 409 });
  });
});

describe("the review queue and its count agree", () => {
  it("leaves out undecided claims whose account is no longer pending, in the list and the overview count", async () => {
    const stale = await makeUser("ALUMNI"); // ACTIVE: e.g. provisioned by an admin meanwhile
    await prisma.alumniClaim.create({ data: { userId: stale.id, ...proof() } });

    expect((await listPendingClaims()).some((c) => c.user.id === stale.id)).toBe(false);
    const { PENDING_CLAIM_WHERE } = await import("@/lib/services/alumni.service");
    const counted = await prisma.alumniClaim.count({ where: { ...PENDING_CLAIM_WHERE, userId: stale.id } });
    expect(counted).toBe(0);
  });
});
