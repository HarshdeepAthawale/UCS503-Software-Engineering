import { describe, it, expect } from "vitest";
import { isAdminRole, portalForRole } from "@/lib/domain/admin-portal";

/** Which sign-in door each role must use: admins at /admin, members at /. */

describe("portalForRole", () => {
  it("sends both admin roles to the admin portal", () => {
    expect(portalForRole("ADMIN")).toBe("admin");
    expect(portalForRole("SUPER_ADMIN")).toBe("admin");
  });

  it("sends every member role to the main sign-in", () => {
    expect(portalForRole("STUDENT")).toBe("member");
    expect(portalForRole("FACULTY")).toBe("member");
    expect(portalForRole("ALUMNI")).toBe("member");
  });
});

describe("isAdminRole", () => {
  it("is true only for ADMIN and SUPER_ADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminRole("FACULTY")).toBe(false);
    expect(isAdminRole("STUDENT")).toBe(false);
  });
});
