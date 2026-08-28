import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";

/**
 * Admin bootstrap — the ONLY thing this project seeds, and it seeds no mock data.
 *
 * The platform needs exactly one real administrator to exist so alumni claims can
 * be approved and the taxonomy managed. Rather than committing a fake account,
 * this script provisions ONE admin from operator-supplied environment variables:
 *
 *   ADMIN_EMAIL=you@thapar.edu ADMIN_PASSWORD='<strong-secret>' npm run bootstrap:admin
 *
 * It refuses to run without real credentials, never uses a default password, and
 * is idempotent (does nothing if an admin already exists). No users, profiles,
 * skills, applications, or any other sample rows are created — the database starts
 * empty except for the single real admin (codeguard-1-hardcoded-credentials).
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment to bootstrap the admin.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });
  if (existingAdmin) {
    console.log("An admin already exists — nothing to do.");
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      name: "Administrator",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Admin provisioned for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
