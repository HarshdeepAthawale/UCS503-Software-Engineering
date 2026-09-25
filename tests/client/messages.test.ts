import { describe, it, expect } from "vitest";
import { awaitingReply, groupByDay, threadMatches } from "@/lib/client/messages";
import type { MessageThreadSummary } from "@/lib/client/api";

/** Inbox helpers: day grouping, reply accountability, and search. */

const thread = (lastSenderId: string): MessageThreadSummary => ({
  applicationId: "a1",
  opportunity: { id: "o1", title: "Research assistant - Computer Vision" },
  status: "SHORTLISTED",
  student: { id: "stu", name: "Asha Verma", role: "STUDENT" },
  poster: { id: "prof", name: "Dr. Rao", role: "FACULTY" },
  counterpart: { id: "prof", name: "Dr. Rao", role: "FACULTY" },
  lastMessage: { body: "Can you meet Thursday?", createdAt: "2026-09-20T10:00:00Z", senderId: lastSenderId, senderName: "Dr. Rao" },
});

describe("awaitingReply", () => {
  it("is true when the last word came from the other side", () => {
    expect(awaitingReply(thread("prof"), "stu")).toBe(true);
    expect(awaitingReply(thread("stu"), "stu")).toBe(false);
  });
});

describe("threadMatches", () => {
  it("matches the other person or the posting, ignoring case", () => {
    expect(threadMatches(thread("prof"), "rao")).toBe(true);
    expect(threadMatches(thread("prof"), "computer VISION")).toBe(true);
    expect(threadMatches(thread("prof"), "  ")).toBe(true);
    expect(threadMatches(thread("prof"), "internship")).toBe(false);
  });
});

describe("groupByDay", () => {
  it("groups consecutive messages under their calendar day, in order", () => {
    const m = (id: string, iso: string) => ({ id, senderId: "x", senderName: "X", body: id, createdAt: iso });
    const groups = groupByDay([
      m("1", "2026-09-19T09:00:00+05:30"),
      m("2", "2026-09-19T18:00:00+05:30"),
      m("3", "2026-09-20T08:00:00+05:30"),
    ]);
    expect(groups.map((g) => g.messages.map((x) => x.id))).toEqual([["1", "2"], ["3"]]);
    expect(groups[0]!.key).not.toBe(groups[1]!.key);
  });
});
