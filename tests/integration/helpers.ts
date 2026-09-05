import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma, Role } from "@prisma/client";

/**
 * Fixture builders shared across the integration suite. Every row is unique
 * per call (random UUID in the email/name), so tests never collide with each
 * other or with leftover data from a previous run - no truncate-between-tests
 * needed. `example.test` is the RFC 2606 reserved test domain, never a real
 * mailbox.
 */

export async function makeUser(role: Role, status: "ACTIVE" | "UNVERIFIED" | "PENDING_ALUMNI" = "ACTIVE") {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `${role.toLowerCase()}.${id}@example.test`,
      passwordHash: "unused-in-integration-tests",
      role,
      status,
      name: `Test ${role} ${id.slice(0, 8)}`,
    },
  });
}

export async function makeSkill(domain = "Programming") {
  const id = randomUUID();
  return prisma.skill.create({
    data: { name: `Skill ${id}`, domain },
  });
}

export async function makeOpportunity(
  posterId: string,
  overrides: Partial<Prisma.OpportunityUncheckedCreateInput> = {},
) {
  return prisma.opportunity.create({
    data: {
      posterId,
      type: "RESEARCH",
      title: `Test Opportunity ${randomUUID()}`,
      description: "Integration test posting.",
      domain: "CS",
      seatCount: 1,
      deadline: new Date(Date.now() + 7 * 86400000),
      slaPledge: "H48",
      status: "LIVE",
      ...overrides,
    },
  });
}

export async function makeApplication(
  opportunityId: string,
  studentId: string,
  status: "APPLIED" | "SHORTLISTED" | "INTERVIEW" | "SELECTED" | "REJECTED" | "WITHDRAWN" = "APPLIED",
) {
  return prisma.application.create({
    data: { opportunityId, studentId, status },
  });
}

export async function claimSkill(userId: string, skillId: string) {
  await prisma.profile.upsert({ where: { userId }, create: { userId }, update: {} });
  await prisma.userSkill.create({ data: { userId, skillId, proficiency: "INTERMEDIATE" } });
}
