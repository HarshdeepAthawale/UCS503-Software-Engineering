import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const e2eUsers = await prisma.user.findMany({
  where: {
    deletedAt: null,
    OR: [
      { name: { contains: "E2E", mode: "insensitive" } },
      { email: { contains: "e2e", mode: "insensitive" } },
    ],
  },
  select: { id: true, email: true, name: true, role: true },
});

const e2eOpps = await prisma.opportunity.findMany({
  where: {
    deletedAt: null,
    OR: [
      { title: { contains: "E2E", mode: "insensitive" } },
      { description: { contains: "E2E", mode: "insensitive" } },
    ],
  },
  select: { id: true, title: true, poster: { select: { name: true, email: true } } },
});

const allTeams = await prisma.team.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    name: true,
    hackathon: true,
    lead: { select: { name: true, email: true } },
  },
});

const deletedTeams = await prisma.team.findMany({
  where: { deletedAt: { not: null } },
  select: { id: true, name: true, hackathon: true, deletedAt: true },
  take: 20,
});

console.log("e2eUsers", JSON.stringify(e2eUsers, null, 2));
console.log("e2eOpps", JSON.stringify(e2eOpps, null, 2));
console.log("teams", JSON.stringify(allTeams, null, 2));
console.log("deletedTeams", JSON.stringify(deletedTeams, null, 2));
await prisma.$disconnect();
