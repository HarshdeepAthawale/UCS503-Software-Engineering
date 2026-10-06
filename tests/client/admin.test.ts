import { describe, expect, it } from "vitest";
import type { AdminOverview } from "@/lib/client/api";
import { adminTabs, attentionItems, parseAdminTab } from "@/lib/client/admin";

const overview = (o: Partial<AdminOverview> = {}): AdminOverview => ({
  users: { STUDENT: 10 },
  opportunities: { live: 4, atRisk: 0 },
  applications: 20,
  pendingClaims: 0,
  openFlags: 0,
  ...o,
});

describe("adminTabs", () => {
  it("shows the Admins tab to the super admin only", () => {
    expect(adminTabs(false).map((t) => t.value)).not.toContain("admins");
    expect(adminTabs(true).map((t) => t.value)).toContain("admins");
  });
});

describe("parseAdminTab", () => {
  it("falls back to the overview for unknown tabs and for Admins when not super", () => {
    expect(parseAdminTab("flags", false)).toBe("flags");
    expect(parseAdminTab("nope", true)).toBe("overview");
    expect(parseAdminTab("admins", false)).toBe("overview");
    expect(parseAdminTab(null, false)).toBe("overview");
  });
});

describe("attentionItems", () => {
  it("is empty when nothing needs an admin", () => {
    expect(attentionItems(overview())).toEqual([]);
  });

  it("lists open flags first, with a singular or plural label", () => {
    const items = attentionItems(overview({ openFlags: 1, opportunities: { live: 4, atRisk: 3 } }));
    expect(items.map((i) => i.key)).toEqual(["flags", "atRisk"]);
    expect(items[0]!.label).toBe("posting flag to review");
    expect(items[1]!.label).toBe("postings at risk of going silent");
  });
});

describe("alumni claims", () => {
  it("has its own tab, and the attention item links to it", () => {
    expect(adminTabs(false).map((t) => t.value)).toContain("claims");
    const item = attentionItems(overview({ pendingClaims: 2 }))[0]!;
    expect(item).toMatchObject({ key: "claims", tab: "claims", label: "alumni claims awaiting review" });
  });
});
