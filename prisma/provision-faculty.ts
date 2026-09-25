import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";

/**
 * One-off operator script: provision or reset a faculty test account (any email).
 *
 *   FACULTY_EMAIL=harshdeep0x01@gmail.com FACULTY_PASSWORD='YourSecurePass1' npm run provision:faculty
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.FACULTY_EMAIL?.trim().toLowerCase();
  const password = process.env.FACULTY_PASSWORD;
  const name = process.env.FACULTY_NAME?.trim() || "Faculty Tester";

  if (!email || !password) {
    throw new Error("Set FACULTY_EMAIL and FACULTY_PASSWORD in the environment.");
  }
  if (password.length < 12) {
    throw new Error("FACULTY_PASSWORD must be at least 12 characters.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("FACULTY_PASSWORD must include upper, lower, and a digit.");
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, role: true, status: true, deletedAt: true },
  });

  if (existing?.deletedAt) {
    throw new Error(`Account for ${email} is soft-deleted; restore it manually first.`);
  }
  if (existing?.role === "ADMIN" || existing?.role === "SUPER_ADMIN") {
    throw new Error("Cannot change an admin account.");
  }

  const passwordHash = await hashPassword(password);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, passwordHash, role: "FACULTY", status: "ACTIVE" },
        select: { id: true, email: true, name: true, role: true, status: true },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "FACULTY",
          status: "ACTIVE",
        },
        select: { id: true, email: true, name: true, role: true, status: true },
      });

  await prisma.facultyAllowlist.upsert({
    where: { email },
    create: { email, note: "Test faculty (provision script)" },
    update: { note: "Test faculty (provision script)" },
  });

  console.log(`${existing ? "Updated" : "Provisioned"} faculty account:`);
  console.log(JSON.stringify(user, null, 2));
  console.log("Sign in at /login with email + password.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
