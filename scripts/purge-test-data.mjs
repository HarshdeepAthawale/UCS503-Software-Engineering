import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Operator script — soft-delete integration / demo / E2E fixture rows that
 * leaked into a shared database. Never touches ADMIN accounts.
 *
 *   npm run purge:test-data -- --dry-run
 *   npm run purge:test-data -- --confirm
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const now = new Date();

const mockUsers = await prisma.user.findMany({
  where: {
    deletedAt: null,
    role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
    OR: [
      { email: { endsWith: "@example.test" } },
      { email: { startsWith: "demo." } },
      { email: { contains: "bench+" } },
      { name: { startsWith: "Test " } },
      { name: { contains: "E2E", mode: "insensitive" } },
      { email: { contains: "e2e", mode: "insensitive" } },
    ],
  },
  select: { id: true, email: true, name: true },
});

const mockUserIds = mockUsers.map((u) => u.id);

const mockOppIds = (
  await prisma.opportunity.findMany({
    where: {
      deletedAt: null,
      OR: [
        { title: { startsWith: "Test Opportunity " } },
        { description: "Integration test posting." },
        { title: { contains: "E2E", mode: "insensitive" } },
        ...(mockUserIds.length ? [{ posterId: { in: mockUserIds } }] : []),
      ],
    },
    select: { id: true, title: true },
  })
).map((o) => o.id);

const mockTeamIds = (
  await prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { hackathon: "Integration Hackathon" },
        { name: { in: ["Integration Team", "Re-request Team"] } },
        { name: { contains: "E2E", mode: "insensitive" } },
        { hackathon: { contains: "E2E", mode: "insensitive" } },
        ...(mockUserIds.length ? [{ leadId: { in: mockUserIds } }] : []),
      ],
    },
    select: { id: true, name: true },
  })
).map((t) => t.id);

const mockSkillIds = (
  await prisma.skill.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { startsWith: "Skill " } },
        { name: { contains: "e2e", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  })
).map((s) => s.id);

console.log(
  JSON.stringify(
    {
      mockUsers: mockUsers.map((u) => ({ email: u.email, name: u.name })),
      mockOpportunities: mockOppIds.length,
      mockTeams: mockTeamIds.length,
      mockSkills: mockSkillIds.length,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--dry-run")) {
  console.log("\nDry run — no changes made.");
  await prisma.$disconnect();
  process.exit(0);
}

if (!process.argv.includes("--confirm")) {
  console.error("\nPass --confirm to soft-delete the rows above (or --dry-run to preview).");
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(async (tx) => {
  if (mockOppIds.length) {
    await tx.applicationEvent.deleteMany({
      where: { application: { opportunityId: { in: mockOppIds } } },
    });
    await tx.application.updateMany({
      where: { opportunityId: { in: mockOppIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.opportunitySkill.deleteMany({ where: { opportunityId: { in: mockOppIds } } });
    await tx.opportunity.updateMany({
      where: { id: { in: mockOppIds } },
      data: { deletedAt: now, status: "CLOSED" },
    });
  }

  if (mockTeamIds.length) {
    const roleIds = (
      await tx.teamRole.findMany({
        where: { teamId: { in: mockTeamIds } },
        select: { id: true },
      })
    ).map((r) => r.id);

    if (roleIds.length) {
      await tx.teamJoinRequest.deleteMany({ where: { teamRoleId: { in: roleIds } } });
      await tx.teamRoleSkill.deleteMany({ where: { teamRoleId: { in: roleIds } } });
    }
    await tx.teamMember.deleteMany({ where: { teamId: { in: mockTeamIds } } });
    await tx.teamRole.deleteMany({ where: { teamId: { in: mockTeamIds } } });
    await tx.meeting.updateMany({
      where: { teamId: { in: mockTeamIds }, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
    await tx.team.updateMany({
      where: { id: { in: mockTeamIds } },
      data: { deletedAt: now, status: "CLOSED" },
    });
  }

  if (mockUserIds.length) {
    await tx.applicationEvent.deleteMany({
      where: { application: { studentId: { in: mockUserIds } } },
    });
    await tx.application.updateMany({
      where: {
        deletedAt: null,
        OR: [{ studentId: { in: mockUserIds } }, { opportunity: { posterId: { in: mockUserIds } } }],
      },
      data: { deletedAt: now },
    });
    await tx.teamJoinRequest.deleteMany({ where: { studentId: { in: mockUserIds } } });
    await tx.teamMember.deleteMany({ where: { userId: { in: mockUserIds } } });
    await tx.userSkill.deleteMany({ where: { userId: { in: mockUserIds } } });
    await tx.profileProject.updateMany({
      where: { userId: { in: mockUserIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.profile.deleteMany({ where: { userId: { in: mockUserIds } } });
    await tx.user.updateMany({
      where: { id: { in: mockUserIds } },
      data: { deletedAt: now, status: "SUSPENDED" },
    });
  }

  if (mockSkillIds.length) {
    await tx.skill.updateMany({
      where: { id: { in: mockSkillIds } },
      data: { deletedAt: now },
    });
  }
});

console.log("\nMock / fixture data removed.");
await prisma.$disconnect();
