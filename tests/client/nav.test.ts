import { describe, it, expect } from "vitest";
import { initials, primaryNav, tabNav } from "@/lib/client/nav";
import type { SessionUser } from "@/lib/client/api";

/** The app navigation: who sees what, and which item is active where. */

const as = (role: SessionUser["role"]): SessionUser => ({ id: "u1", role, status: "ACTIVE", name: "Asha Verma" });
const labels = (role: SessionUser["role"]) => primaryNav(as(role)).map((i) => i.label);
const activeOn = (role: SessionUser["role"], path: string) =>
  tabNav(as(role)).filter((i) => i.match(path)).map((i) => i.label);

describe("primaryNav", () => {
  it("gives each role only its own destinations", () => {
    expect(labels("STUDENT")).toEqual(["Opportunities", "Applications", "Teams", "Messages"]);
    expect(labels("FACULTY")).toEqual(["Opportunities", "My postings", "Messages"]);
    expect(labels("ALUMNI")).toEqual(["Opportunities", "My postings", "Messages"]);
    expect(labels("ADMIN")).toEqual(["Console", "Opportunities"]);
    expect(labels("SUPER_ADMIN")).toEqual(["Console", "Opportunities"]);
  });
});

describe("active state", () => {
  it("does not light Opportunities on a poster's own pages", () => {
    expect(activeOn("FACULTY", "/opportunities/mine")).toEqual(["My postings"]);
    expect(activeOn("FACULTY", "/opportunities/new")).toEqual(["My postings"]);
    expect(activeOn("FACULTY", "/opportunities/abc/applicants")).toEqual(["My postings"]);
    expect(activeOn("FACULTY", "/opportunities/abc/edit")).toEqual(["My postings"]);
  });

  it("lights Opportunities on the list and a posting's page", () => {
    expect(activeOn("STUDENT", "/opportunities")).toEqual(["Opportunities"]);
    expect(activeOn("STUDENT", "/opportunities/abc")).toEqual(["Opportunities"]);
  });

  it("matches nested pages to their section", () => {
    expect(activeOn("STUDENT", "/applications/abc")).toEqual(["Applications"]);
    expect(activeOn("STUDENT", "/teams/abc/requests")).toEqual(["Teams"]);
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Asha Verma")).toBe("AV");
    expect(initials("Harshdeep Shantaram Athawale")).toBe("HA");
    expect(initials("madonna")).toBe("M");
    expect(initials("   ")).toBe("?");
  });
});
