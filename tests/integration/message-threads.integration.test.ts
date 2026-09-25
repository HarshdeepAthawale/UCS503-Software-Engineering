import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { makeApplication, makeOpportunity, makeUser } from "./helpers";
import { listMyThreads, sendMessage } from "@/lib/services/message.service";
import type { Principal } from "@/lib/iam/policy";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * The inbox: one entry per application that has messages, newest activity
 * first, with the other participant named for whoever is looking.
 */

const as = (u: { id: string; role: Principal["role"] }): Principal => ({ userId: u.id, role: u.role, status: "ACTIVE" });

describe("listMyThreads", () => {
  it("lists only conversations with messages, newest first, from either side", async () => {
    const poster = await makeUser("FACULTY");
    const [alice, bob, carol] = await Promise.all([makeUser("STUDENT"), makeUser("STUDENT"), makeUser("STUDENT")]);
    const opp = await makeOpportunity(poster.id);
    const [a, b] = await Promise.all([
      makeApplication(opp.id, alice.id),
      makeApplication(opp.id, bob.id),
      makeApplication(opp.id, carol.id), // never messaged - must not appear
    ]);
    // A thread row with no messages must not appear either.
    await prisma.messageThread.create({ data: { applicationId: (await makeApplication((await makeOpportunity(poster.id)).id, carol.id)).id } });

    await sendMessage(as(alice), a.id, "Hello from Alice");
    await sendMessage(as(poster), b.id, "Hello Bob");
    await new Promise((r) => setTimeout(r, 5));
    await sendMessage(as(alice), a.id, "Following up");

    const posterView = (await listMyThreads(as(poster))).threads;
    expect(posterView.map((t) => t.applicationId)).toEqual([a.id, b.id]);
    expect(posterView[0]!.counterpart.name).toBe(alice.name);
    expect(posterView[0]!.lastMessage.body).toBe("Following up");
    expect(posterView[0]!.lastMessage.senderId).toBe(alice.id);

    const bobView = (await listMyThreads(as(bob))).threads;
    expect(bobView).toHaveLength(1);
    expect(bobView[0]!.counterpart.name).toBe(poster.name);
    expect(bobView[0]!.lastMessage.senderName).toBe(poster.name);
  });
});
