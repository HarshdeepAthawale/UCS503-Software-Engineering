import { beforeEach, describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { mailer } from "@/lib/email/mailer";
import { makeUser } from "./helpers";
import { notify, runDigest } from "@/lib/services/notification.service";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * Notifications leave the app (T-17): a poster who never opens Nexus must still
 * hear that an applicant is waiting. IMMEDIATE preference → emailed now;
 * DAILY/WEEKLY → batched by the digest job into one message.
 */

const send = vi.mocked(mailer.send);
const H = 3_600_000;

async function pending(userId: string) {
  return prisma.notification.count({ where: { userId, deliveredAt: null } });
}

async function prefer(userId: string, frequency: "IMMEDIATE" | "DAILY" | "WEEKLY", lastDigestAt: Date | null) {
  await prisma.notificationPreference.create({ data: { userId, frequency, lastDigestAt } });
}

function mailsTo(email: string) {
  return send.mock.calls.map(([m]) => m).filter((m) => m.to === email);
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe("notification delivery", () => {
  it("emails an IMMEDIATE user straight away and marks it delivered", async () => {
    const poster = await makeUser("FACULTY");
    await prefer(poster.id, "IMMEDIATE", null);

    await notify(poster.id, "opportunity.at_risk", { opportunityId: "o1" });

    const mails = mailsTo(poster.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.text).toContain("A posting is at risk");
    expect(await pending(poster.id)).toBe(0);
  });

  it("holds a DAILY user's notification until their digest is due", async () => {
    const poster = await makeUser("FACULTY");
    await prefer(poster.id, "DAILY", new Date(Date.now() - 2 * H));

    await notify(poster.id, "application.received", { opportunityId: "o1" });

    expect(mailsTo(poster.email)).toHaveLength(0);
    expect(await pending(poster.id)).toBe(1);
  });

  it("the digest batches everything pending for a due user into one email", async () => {
    const poster = await makeUser("FACULTY");
    await prefer(poster.id, "DAILY", new Date(Date.now() - 2 * H));
    await notify(poster.id, "application.received", { opportunityId: "o1" });
    await notify(poster.id, "opportunity.at_risk", { opportunityId: "o1" });

    await runDigest(new Date(Date.now() + 21 * H)); // 23h since the last digest - not due
    expect(mailsTo(poster.email)).toHaveLength(0);

    await runDigest(new Date(Date.now() + 23 * H)); // 25h - due
    const mails = mailsTo(poster.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toBe("2 updates on Thapar Nexus");
    expect(await pending(poster.id)).toBe(0);
  });

  it("keeps a notification pending for the next run when the send fails", async () => {
    const poster = await makeUser("FACULTY");
    await prefer(poster.id, "IMMEDIATE", null);
    send.mockRejectedValue(new Error("provider down"));

    await notify(poster.id, "opportunity.at_risk", { opportunityId: "o1" });
    expect(await pending(poster.id)).toBe(1);

    send.mockReset();
    send.mockResolvedValue(undefined);
    await runDigest();
    expect(mailsTo(poster.email)).toHaveLength(1);
    expect(await pending(poster.id)).toBe(0);
  });

  it("never emails a suspended account, and does not retry it forever", async () => {
    const poster = await makeUser("FACULTY");
    await prisma.user.update({ where: { id: poster.id }, data: { status: "SUSPENDED" } });

    await notify(poster.id, "opportunity.at_risk", { opportunityId: "o1" });

    expect(mailsTo(poster.email)).toHaveLength(0);
    expect(await pending(poster.id)).toBe(0);
  });
});
