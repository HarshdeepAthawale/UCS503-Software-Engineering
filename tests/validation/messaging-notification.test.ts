import { describe, it, expect } from "vitest";
import {
  MessageSendSchema,
  NotificationsReadSchema,
  NotificationPrefSchema,
} from "@/lib/validation/schemas";
import { isDue } from "@/lib/domain/digest";

/** Messaging (T-16) & notification (T-17) DTO + digest-cadence tests. */

describe("MessageSendSchema (T-16)", () => {
  it("accepts a non-empty body", () => {
    expect(MessageSendSchema.safeParse({ body: "Hello there" }).success).toBe(true);
  });
  it("rejects an empty / whitespace body", () => {
    expect(MessageSendSchema.safeParse({ body: "   " }).success).toBe(false);
  });
  it("rejects unknown keys (no senderId injection)", () => {
    expect(MessageSendSchema.safeParse({ body: "hi", senderId: "x" }).success).toBe(false);
  });
});

describe("NotificationsReadSchema (T-17)", () => {
  it("accepts an empty body (mark all)", () => {
    expect(NotificationsReadSchema.safeParse({}).success).toBe(true);
  });
  it("accepts a list of uuids", () => {
    const r = NotificationsReadSchema.safeParse({
      ids: ["6f7c3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e5f"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects non-uuid ids", () => {
    expect(NotificationsReadSchema.safeParse({ ids: ["nope"] }).success).toBe(false);
  });
});

describe("NotificationPrefSchema (T-17)", () => {
  it("accepts a valid cadence", () => {
    expect(NotificationPrefSchema.safeParse({ frequency: "WEEKLY" }).success).toBe(true);
  });
  it("rejects an unknown cadence", () => {
    expect(NotificationPrefSchema.safeParse({ frequency: "HOURLY" }).success).toBe(false);
  });
});

describe("digest cadence (isDue)", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("IMMEDIATE is always due", () => {
    expect(isDue("IMMEDIATE", hoursAgo(0.1), now)).toBe(true);
  });
  it("a first-ever digest (no lastDigestAt) is due", () => {
    expect(isDue("DAILY", null, now)).toBe(true);
  });
  it("DAILY waits ~24h", () => {
    expect(isDue("DAILY", hoursAgo(23), now)).toBe(false);
    expect(isDue("DAILY", hoursAgo(25), now)).toBe(true);
  });
  it("WEEKLY waits ~7 days", () => {
    expect(isDue("WEEKLY", hoursAgo(24 * 6), now)).toBe(false);
    expect(isDue("WEEKLY", hoursAgo(24 * 8), now)).toBe(true);
  });
});
