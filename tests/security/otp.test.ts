import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, verifyOtp } from "@/lib/security/otp";

describe("OTP", () => {
  it("generates a 6-digit numeric code", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("verifies a correct code against its hash (constant-time)", () => {
    const code = generateOtp();
    const hash = hashOtp(code);
    expect(verifyOtp(code, hash)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const hash = hashOtp("123456");
    expect(verifyOtp("654321", hash)).toBe(false);
  });

  it("never stores the raw code (hash differs from code)", () => {
    const code = "000123";
    expect(hashOtp(code)).not.toContain(code);
    expect(hashOtp(code)).toHaveLength(64); // sha-256 hex
  });
});
