import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const teams = await prisma.team.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    name: true,
    hackathon: true,
    description: true,
    status: true,
    lead: { select: { email: true, name: true } },
  },
  orderBy: { createdAt: "desc" },
});

console.log(JSON.stringify(teams, null, 2));
await prisma.$disconnect();
