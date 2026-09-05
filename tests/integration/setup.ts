/**
 * Integration-suite setup - a REAL Postgres, not the stubbed values in
 * tests/setup.ts. Explicit here (rather than relying on tests/setup.ts's
 * `??=` default) so a reader of this file alone knows it needs a live DB.
 */
process.env.DATABASE_URL = "postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public";
process.env.DIRECT_URL = "postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-that-is-long-enough-32";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-that-is-long-enough-32";
process.env.ALLOW_INSECURE_COOKIES ??= "true";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-token-encryption-key-that-is-long-enough-32";

import { afterAll } from "vitest";

// A dynamic import, not a static one: static `import ... from "@/lib/db"`
// would be hoisted above the process.env assignments above (ES modules
// hoist all imports ahead of other statements regardless of source order),
// so @/lib/db would read the WRONG DATABASE_URL before this file ever had a
// chance to override it. Deferring to a dynamic import keeps it in place.
afterAll(async () => {
  const { prisma } = await import("@/lib/db");
  await prisma.$disconnect();
});
