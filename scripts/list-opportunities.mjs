import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const opps = await prisma.opportunity.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    title: true,
    status: true,
    type: true,
    description: true,
    createdAt: true,
    poster: { select: { email: true, name: true } },
  },
  orderBy: { createdAt: "desc" },
});

console.log(JSON.stringify(opps, null, 2));
await prisma.$disconnect();
