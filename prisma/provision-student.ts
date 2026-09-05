import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";

/**
 * One-off operator script: provision or promote a student account by email.
 *
 *   STUDENT_EMAIL=user@example.com STUDENT_NAME="Full Name" npm run provision:student
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.STUDENT_EMAIL?.trim().toLowerCase();
  const name = process.env.STUDENT_NAME?.trim() || "Student";

  if (!email) {
    throw new Error("Set STUDENT_EMAIL in the environment.");
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, role: true, status: true, deletedAt: true },
  });

  if (existing?.deletedAt) {
    throw new Error(`Account for ${email} is soft-deleted; restore it manually first.`);
  }

  if (existing) {
    if (existing.role === "ADMIN") {
      throw new Error("Cannot change the administrator account.");
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: "STUDENT", status: "ACTIVE" },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    console.log(`Updated existing account: ${JSON.stringify(updated)}`);
    return;
  }

  const unusable = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`);
  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: unusable,
      role: "STUDENT",
      status: "ACTIVE",
    },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  console.log(`Provisioned student account: ${JSON.stringify(created)}`);
  console.log("Sign in via email code at /login (passwordless OTP).");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
