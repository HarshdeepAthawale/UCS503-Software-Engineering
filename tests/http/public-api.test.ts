import { describe, it, expect } from "vitest";
import { isPublicApi } from "@/lib/http/public-api";

/** Which /api paths skip the edge sign-in check - only the doors in, never data. */
describe("isPublicApi", () => {
  it("opens the sign-up and sign-in doors, alumni sign-up included", () => {
    expect(isPublicApi("/api/auth/register")).toBe(true);
    expect(isPublicApi("/api/auth/register-alumni")).toBe(true);
    expect(isPublicApi("/api/auth/otp-login/request")).toBe(true);
    expect(isPublicApi("/api/health")).toBe(true);
    expect(isPublicApi("/api/auth/password-reset/request")).toBe(true);
    expect(isPublicApi("/api/auth/password-reset/confirm")).toBe(true);
  });

  it("keeps everything else behind sign-in, including look-alike paths", () => {
    expect(isPublicApi("/api/alumni/claim")).toBe(false);
    expect(isPublicApi("/api/admin/alumni-claims")).toBe(false);
    expect(isPublicApi("/api/auth/registered-users")).toBe(false);
    expect(isPublicApi("/api/healthz")).toBe(false);
  });
});
