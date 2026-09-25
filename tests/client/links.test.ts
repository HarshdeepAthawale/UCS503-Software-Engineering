import { describe, it, expect } from "vitest";
import { normalizeLink } from "@/lib/client/links";
import { ProfileUpdateSchema } from "@/lib/validation/schemas";

/** Links typed the way people type them still save. */

describe("normalizeLink", () => {
  it("adds https:// to a bare domain", () => {
    expect(normalizeLink("github.com/asha")).toBe("https://github.com/asha");
    expect(normalizeLink("www.linkedin.com/in/asha")).toBe("https://www.linkedin.com/in/asha");
  });

  it("keeps a link that already has a scheme", () => {
    expect(normalizeLink("https://asha.dev")).toBe("https://asha.dev");
    expect(normalizeLink("HTTP://asha.dev")).toBe("HTTP://asha.dev");
  });

  it("turns an empty field into null (clears the link)", () => {
    expect(normalizeLink("   ")).toBeNull();
  });

  it("does not disguise a dangerous scheme - the server still refuses it", () => {
    const link = normalizeLink("javascript:alert(1)");
    expect(ProfileUpdateSchema.safeParse({ websiteUrl: link }).success).toBe(false);
  });

  it("produces links the profile schema accepts", () => {
    const parsed = ProfileUpdateSchema.safeParse({
      githubUrl: normalizeLink("github.com/asha"),
      linkedinUrl: normalizeLink("linkedin.com/in/asha"),
      websiteUrl: normalizeLink(""),
    });
    expect(parsed.success).toBe(true);
  });
});
