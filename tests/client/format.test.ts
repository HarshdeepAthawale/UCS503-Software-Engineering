import { afterEach, describe, expect, it, vi } from "vitest";
import { timeAgo } from "@/lib/client/format";

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());

  it("is relative within a week", () => {
    vi.useFakeTimers({ now: new Date("2026-09-26T12:00:00Z") });
    expect(timeAgo("2026-09-26T09:00:00Z")).toBe("3h ago");
    expect(timeAgo("2026-09-23T12:00:00Z")).toBe("3d ago");
  });

  it("shows a readable Indian-format date after a week, not the browser's M/D/YYYY", () => {
    vi.useFakeTimers({ now: new Date("2026-09-26T12:00:00Z") });
    expect(timeAgo("2026-08-18T12:00:00Z")).toBe("18 Aug 2026");
  });
});
