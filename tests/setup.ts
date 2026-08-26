/**
 * Vitest global setup — makes tests self-contained.
 *
 * `src/lib/env.ts` validates required secrets at import time, and
 * `src/lib/validation/schemas.ts` (and anything importing it) pulls env in.
 * Tests never need real secrets — these are throwaway test values, the same
 * shape CI provides (codeguard-1-hardcoded-credentials: test-only values,
 * never real credentials, and never committed secrets).
 */
process.env.DATABASE_URL ??= "postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-that-is-long-enough-32";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-that-is-long-enough-32";
process.env.ALLOW_INSECURE_COOKIES ??= "true";
