import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with **scrypt** - a memory-hard KDF recommended by OWASP and
 * built into Node's `crypto`, so it needs no native compilation (unlike argon2,
 * which requires a C++ toolchain we cannot assume on every machine). Each hash
 * carries its own random salt and its parameters, so we can raise the cost later
 * without breaking existing hashes (codeguard-0-authentication-mfa).
 *
 * Stored format: `scrypt$N$r$p$<saltB64>$<hashB64>`
 */
const N = 32768; // CPU/memory cost (2^15)
const R = 8; // block size
const P = 1; // parallelisation
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024; // headroom for N*r*128 bytes

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64!, "base64");
    const expected = Buffer.from(hashB64!, "base64");
    const derived = await scrypt(plain, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    // Constant-time comparison to avoid timing side channels.
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burn equivalent work when the account does not exist, so login response timing
 * does not reveal whether an email is registered (account-enumeration defence).
 */
const DUMMY_SALT = randomBytes(16);
export async function dummyVerify(plain: string): Promise<false> {
  try {
    await scrypt(plain, DUMMY_SALT, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  } catch {
    /* ignore */
  }
  return false;
}
