import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const opps = await prisma.opportunity.findMany({
  where: { deletedAt: null, status: "LIVE" },
  select: {
    title: true,
    poster: { select: { name: true, email: true } },
  },
  orderBy: { createdAt: "desc" },
});

const users = await prisma.user.findMany({
  where: { deletedAt: null },
  select: { name: true, email: true, role: true },
  orderBy: { createdAt: "desc" },
  take: 50,
});

console.log("LIVE opps:", opps.map((o) => `${o.title} | ${o.poster.name} <${o.poster.email}>`).join("\n"));
console.log("\nRecent users:", users.map((u) => `${u.name} <${u.email}> (${u.role})`).join("\n"));
await prisma.$disconnect();
