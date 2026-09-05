import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Symmetric encryption for a secret that must be read back in full later - a
 * stored Google Calendar refresh token, unlike a password/OTP/refresh-session
 * token (tokens.ts, password.ts), which are hashed one-way because we only
 * ever need to VERIFY them, never recover the original.
 *
 * AES-256-GCM via Node's built-in `crypto` - no native compilation, same
 * reasoning as scrypt over argon2 in password.ts. The key comes only from
 * `TOKEN_ENCRYPTION_KEY` (codeguard-1-hardcoded-credentials); each ciphertext
 * carries its own random IV and the GCM auth tag, so a stored value is
 * `<ivB64>:<tagB64>:<ciphertextB64>`.
 */

function encryptionKey(): Buffer {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
  }
  // Accept the configured secret as raw UTF-8 and derive a fixed 32-byte key
  // from it via a fast, deterministic hash - the secret itself is free-form
  // text (e.g. `openssl rand -base64 32`), not necessarily exactly 32 bytes
  // once decoded, so this normalizes it for AES-256 without adding a KDF
  // dependency (encryption at rest, not password storage - scrypt is overkill
  // here and would slow every calendar API call for no security benefit).
  return createHash("sha256").update(env.TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12); // GCM standard nonce size
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !ciphertextB64) throw new Error("Malformed encrypted secret.");
  const key = encryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
