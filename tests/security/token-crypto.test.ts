import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/security/token-crypto";

/**
 * Round-trip tests for the AES-256-GCM helper that encrypts a Google Calendar
 * refresh token at rest. Unlike password/OTP hashing (one-way), this must be
 * reversible - decryptSecret(encryptSecret(x)) === x - while still failing
 * closed on any tampering (GCM auth tag).
 */

describe("token-crypto (Google Calendar refresh token at rest)", () => {
  it("round-trips a secret", () => {
    const secret = "1//09aBcDeFgHiJkLmNoPqRsTuVwXyZ-example-refresh-token";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const secret = "same-secret";
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptSecret("a-refresh-token");
    const [iv, tag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${ciphertext!.slice(0, -4)}abcd`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptSecret("not-the-right-shape")).toThrow();
  });
});
