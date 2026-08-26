import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Prisma uses parameterised queries everywhere, which
 * is our primary defence against SQL injection (codeguard-0-input-validation-injection).
 * Never interpolate user input into `$queryRawUnsafe`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
