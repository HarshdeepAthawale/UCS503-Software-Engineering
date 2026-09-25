import { describe, it, expect } from "vitest";
import { profileChecklist, type ChecklistInput } from "@/lib/client/profile-checklist";

/** The profile completeness checklist shown beside the profile form. */

const empty: ChecklistInput = {
  headline: "",
  bio: "",
  branch: "",
  year: "",
  cgpa: "",
  skillCount: 0,
  openToCount: 0,
  hasResume: false,
  hasLink: false,
  projectCount: 0,
};

const full: ChecklistInput = {
  headline: "ML research · vision",
  bio: "I build things.",
  branch: "COE",
  year: "3",
  cgpa: "8.4",
  skillCount: 4,
  openToCount: 2,
  hasResume: true,
  hasLink: true,
  projectCount: 1,
};

describe("profileChecklist (student)", () => {
  it("starts at zero with every step open", () => {
    const c = profileChecklist("STUDENT", empty);
    expect(c.percent).toBe(0);
    expect(c.items.every((i) => !i.done)).toBe(true);
  });

  it("reaches 100% only when every step is done", () => {
    expect(profileChecklist("STUDENT", full).percent).toBe(100);
  });

  it("asks for eligibility details, because posting filters read them", () => {
    const c = profileChecklist("STUDENT", { ...full, cgpa: "" });
    const item = c.items.find((i) => i.key === "academics");
    expect(item?.done).toBe(false);
    expect(item?.section).toBe("academics");
    expect(c.percent).toBeLessThan(100);
  });

  it("needs at least three skills", () => {
    const two = profileChecklist("STUDENT", { ...full, skillCount: 2 });
    expect(two.items.find((i) => i.key === "skills")?.done).toBe(false);
  });

  it("accepts either a link or a project as proof of work", () => {
    expect(profileChecklist("STUDENT", { ...full, hasLink: false, projectCount: 1 }).percent).toBe(100);
    expect(profileChecklist("STUDENT", { ...full, hasLink: true, projectCount: 0 }).percent).toBe(100);
    expect(profileChecklist("STUDENT", { ...full, hasLink: false, projectCount: 0 }).percent).toBeLessThan(100);
  });
});

describe("profileChecklist (poster)", () => {
  it("does not ask faculty for CGPA, a résumé or availability", () => {
    const keys = profileChecklist("FACULTY", empty).items.map((i) => i.key);
    expect(keys).not.toContain("academics");
    expect(keys).not.toContain("resume");
    expect(keys).not.toContain("availability");
    expect(profileChecklist("FACULTY", full).percent).toBe(100);
  });
});
