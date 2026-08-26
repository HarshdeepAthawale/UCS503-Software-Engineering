import { randomInt, createHash, timingSafeEqual } from "node:crypto";

/**
 * One-time passwords for email verification (codeguard-0-authentication-mfa).
 * The raw 6-digit code is emailed to the user and NEVER stored; we persist only
 * its hash, with a short TTL and a bounded attempt counter enforced by the caller.
 */

export function generateOtp(): string {
  // randomInt is a CSPRNG; range yields a zero-padded 6-digit code.
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison to avoid timing side channels. */
export function verifyOtp(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
