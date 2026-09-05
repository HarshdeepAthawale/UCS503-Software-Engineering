import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const patterns = ["E2E", "Test ", "Integration", "example.test"];

const users = await prisma.user.findMany({
  where: {
    deletedAt: null,
    OR: [
      { email: { endsWith: "@example.test" } },
      { name: { contains: "E2E", mode: "insensitive" } },
      { name: { startsWith: "Test ", mode: "insensitive" } },
    ],
  },
  select: { id: true, email: true, name: true, role: true },
});

const opps = await prisma.opportunity.findMany({
  where: {
    deletedAt: null,
    OR: [
      { title: { contains: "E2E", mode: "insensitive" } },
      { title: { startsWith: "Test Opportunity", mode: "insensitive" } },
      { description: "Integration test posting." },
    ],
  },
  select: { id: true, title: true, poster: { select: { email: true, name: true } } },
});

console.log("users:", JSON.stringify(users, null, 2));
console.log("opps:", JSON.stringify(opps, null, 2));
await prisma.$disconnect();
