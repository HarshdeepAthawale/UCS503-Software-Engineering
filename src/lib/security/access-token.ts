import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";
import type { Role } from "@prisma/client";

/**
 * Access-token sign/verify - kept in its own module because it must be
 * EDGE-SAFE (used by src/middleware.ts). It depends only on `jose` (WebCrypto)
 * and Web globals, never `node:crypto`, so it bundles cleanly for the edge
 * runtime. Node-only refresh-token helpers live in tokens.ts.
 *
 * The access token carries no PII beyond the role/status needed for coarse
 * authZ; fine-grained checks always re-load authoritative state from the DB.
 */

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = "thapar-nexus";
const AUDIENCE = "thapar-nexus:api";

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: Role;
  status: string;
  jti: string;
}

export async function signAccessToken(params: {
  userId: string;
  role: Role;
  status: string;
}): Promise<string> {
  return new SignJWT({ role: params.role, status: params.status })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setJti(crypto.randomUUID()) // Web Crypto global - edge-safe
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(accessKey);
}

/** Verify an access token; returns null on any failure (expired/bad/forged). */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
    return payload as AccessClaims;
  } catch {
    return null;
  }
}
