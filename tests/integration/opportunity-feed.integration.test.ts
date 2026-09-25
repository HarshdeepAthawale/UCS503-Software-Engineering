import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { listOpportunities } from "@/lib/services/opportunity.service";
import { makeOpportunity, makeUser } from "./helpers";

/**
 * The discovery feed shows only postings a student can still apply to: not
 * closed by the poster, not expired, and not past the deadline even if the
 * expiry job has not run yet. A poster's own dashboard still sees everything.
 */

const DAY = 86_400_000;

describe("listOpportunities feed", () => {
  it("leaves out closed, expired and past-deadline postings", async () => {
    const poster = await makeUser("FACULTY");
    const tag = randomUUID().slice(0, 8);
    const title = (s: string) => `Feed ${tag} ${s}`;
    await makeOpportunity(poster.id, { title: title("open") });
    await makeOpportunity(poster.id, { title: title("closed"), status: "CLOSED" });
    await makeOpportunity(poster.id, { title: title("expired"), status: "EXPIRED", deadline: new Date(Date.now() - DAY) });
    await makeOpportunity(poster.id, { title: title("lapsed"), status: "LIVE", deadline: new Date(Date.now() - DAY) });
    await makeOpportunity(poster.id, { title: title("atrisk"), status: "AT_RISK" });

    const feed = await listOpportunities({ q: tag, limit: 100 });
    expect(feed.opportunities.map((o) => o.title).sort()).toEqual([title("atrisk"), title("open")]);
  });

  it("still shows a poster every one of their own postings", async () => {
    const poster = await makeUser("FACULTY");
    await makeOpportunity(poster.id, { status: "CLOSED" });
    await makeOpportunity(poster.id, { status: "LIVE", deadline: new Date(Date.now() - DAY) });

    const mine = await listOpportunities({ posterId: poster.id, limit: 100 });
    expect(mine.opportunities).toHaveLength(2);
  });
});
