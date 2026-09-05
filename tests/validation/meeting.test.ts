import { describe, it, expect } from "vitest";
import { MeetingCreateSchema } from "@/lib/validation/schemas";

describe("MeetingCreateSchema (Google Meet scheduling)", () => {
  it("accepts a valid future meeting", () => {
    const r = MeetingCreateSchema.safeParse({
      title: "Interview",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durationMinutes).toBe(30); // default
  });
  it("rejects a meeting scheduled in the past", () => {
    const r = MeetingCreateSchema.safeParse({
      title: "Interview",
      scheduledAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    expect(r.success).toBe(false);
  });
  it("rejects a duration outside 15-240 minutes", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(
      MeetingCreateSchema.safeParse({ title: "x", scheduledAt: future, durationMinutes: 5 }).success,
    ).toBe(false);
    expect(
      MeetingCreateSchema.safeParse({ title: "x", scheduledAt: future, durationMinutes: 300 }).success,
    ).toBe(false);
  });
  it("rejects mass assignment (organizerId/googleEventId)", () => {
    const r = MeetingCreateSchema.safeParse({
      title: "Interview",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      organizerId: "x",
      googleEventId: "y",
    });
    expect(r.success).toBe(false);
  });
});
