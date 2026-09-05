import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/inspect-user.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const user = await prisma.user.findFirst({
  where: { email },
  select: { id: true, email: true, name: true, role: true, status: true, deletedAt: true },
});
const allowlist = await prisma.facultyAllowlist.findUnique({ where: { email } });

console.log(JSON.stringify({ user, allowlist }, null, 2));
await prisma.$disconnect();
