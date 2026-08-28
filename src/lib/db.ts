import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/**
 * Prisma client singleton, backed by the pure-JS `pg` driver adapter + Prisma's
 * WASM query compiler - NO native query-engine binary. This is required on
 * Windows-on-ARM64 (no native engine ships) and is the right fit for Supabase's
 * connection pooler generally.
 *
 * Prisma still parameterises every query, so SQL injection defence is unchanged
 * (codeguard-0-input-validation-injection). Never use `$queryRawUnsafe` with
 * user input.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
