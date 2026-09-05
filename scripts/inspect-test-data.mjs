import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const users = await prisma.user.findMany({
  where: { deletedAt: null, email: { endsWith: "@example.test" } },
  select: { id: true, email: true, name: true, role: true },
});
console.log("example.test users:", JSON.stringify(users, null, 2));

const testOpps = await prisma.opportunity.findMany({
  where: {
    deletedAt: null,
    OR: [
      { title: { startsWith: "Test Opportunity " } },
      { description: "Integration test posting." },
    ],
  },
  select: { id: true, title: true },
});
console.log("test opps:", JSON.stringify(testOpps, null, 2));

await prisma.$disconnect();
