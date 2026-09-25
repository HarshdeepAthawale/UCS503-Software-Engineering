import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { mailer } from "@/lib/email/mailer";
import { hashPassword } from "@/lib/security/password";
import { makeUser } from "./helpers";
import {
  login,
  loginWithGoogle,
  requestLoginOtp,
} from "@/lib/services/auth.service";
import { createAdmin, listAdmins, removeAdmin } from "@/lib/services/admin.service";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * Admins and the one super admin. Admin accounts sign in only at /admin
 * (portal "admin"); the main sign-in refuses them, and refuses nobody else.
 * Only the super admin creates or removes admins, and there is only ever one.
 */

const send = vi.mocked(mailer.send);
const PASSWORD = "Integration-Passw0rd";

async function withPassword(role: "STUDENT" | "ADMIN") {
  const user = await makeUser(role);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(PASSWORD) },
  });
  return user;
}

const asPrincipal = (u: { id: string; role: "SUPER_ADMIN" | "ADMIN" }) => ({
  userId: u.id,
  role: u.role,
  status: "ACTIVE" as const,
});

/** The single SUPER_ADMIN row in the test database (created on first use). */
async function superAdmin() {
  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", deletedAt: null },
  });
  if (existing) return existing as typeof existing & { role: "SUPER_ADMIN" };
  const id = randomUUID();
  return (await prisma.user.create({
    data: {
      id,
      email: `super.${id}@example.test`,
      passwordHash: "unused-in-integration-tests",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      name: "Test Super Admin",
    },
  })) as { id: string; role: "SUPER_ADMIN"; email: string };
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe("sign-in portals", () => {
  it("lets an admin sign in at /admin but not on the main page", async () => {
    const admin = await withPassword("ADMIN");

    const session = await login({ email: admin.email, password: PASSWORD, userAgent: null, portal: "admin" });
    expect(session.user.id).toBe(admin.id);

    await expect(
      login({ email: admin.email, password: PASSWORD, userAgent: null, portal: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Admin accounts sign in at /admin." });
  });

  it("does not let a member sign in at /admin", async () => {
    const student = await withPassword("STUDENT");

    await expect(
      login({ email: student.email, password: PASSWORD, userAgent: null, portal: "admin" }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const session = await login({ email: student.email, password: PASSWORD, userAgent: null, portal: "member" });
    expect(session.user.id).toBe(student.id);
  });

  it("only issues a one-time code through the matching portal", async () => {
    const admin = await makeUser("ADMIN");
    const student = await makeUser("STUDENT");

    expect(await requestLoginOtp(admin.email, "member")).toBeNull();
    expect(await requestLoginOtp(admin.email, "admin")).toMatch(/^\d{6}$/);
    expect(await requestLoginOtp(student.email, "admin")).toBeNull();
    expect(await requestLoginOtp(student.email, "member")).toMatch(/^\d{6}$/);
  });

  it("refuses Google sign-in for an admin account", async () => {
    const id = randomUUID();
    const admin = await prisma.user.create({
      data: {
        id,
        email: `admin.${id}@thapar.edu`,
        passwordHash: "unused-in-integration-tests",
        role: "ADMIN",
        status: "ACTIVE",
        name: "Test Google Admin",
      },
    });

    await expect(
      loginWithGoogle({ email: admin.email, name: admin.name, userAgent: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Admin accounts sign in at /admin." });
  });
});

describe("admin management (super admin)", () => {
  it("creates an active admin and emails them how to sign in", async () => {
    const boss = await superAdmin();
    const email = `new.admin.${randomUUID()}@example.test`;

    const admin = await createAdmin(asPrincipal(boss), { name: "New Admin", email });

    expect(admin).toMatchObject({ email, role: "ADMIN", status: "ACTIVE", name: "New Admin" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ to: email });
    expect(send.mock.calls[0]![0].text).toContain("/admin");
    expect((await listAdmins()).admins.map((a) => a.id)).toContain(admin.id);
  });

  it("refuses to turn an existing member's email into an admin", async () => {
    const boss = await superAdmin();
    const student = await makeUser("STUDENT");

    await expect(
      createAdmin(asPrincipal(boss), { name: "Nope", email: student.email }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("removes an admin: soft-deleted and every session revoked", async () => {
    const boss = await superAdmin();
    const admin = await withPassword("ADMIN");
    await login({ email: admin.email, password: PASSWORD, userAgent: null, portal: "admin" });

    await removeAdmin(asPrincipal(boss), admin.id);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.deletedAt).not.toBeNull();
    const live = await prisma.refreshToken.count({ where: { userId: admin.id, revokedAt: null } });
    expect(live).toBe(0);
    expect((await listAdmins()).admins.map((a) => a.id)).not.toContain(admin.id);
  });

  it("re-creating a removed admin restores the same account", async () => {
    const boss = await superAdmin();
    const email = `returning.${randomUUID()}@example.test`;
    const first = await createAdmin(asPrincipal(boss), { name: "Returning", email });
    await removeAdmin(asPrincipal(boss), first.id);

    const again = await createAdmin(asPrincipal(boss), { name: "Returning", email });

    expect(again.id).toBe(first.id);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.deletedAt).toBeNull();
  });

  it("only removes admins - never the super admin or a member", async () => {
    const boss = await superAdmin();
    const student = await makeUser("STUDENT");

    await expect(removeAdmin(asPrincipal(boss), boss.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(removeAdmin(asPrincipal(boss), student.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("one super admin", () => {
  it("the database refuses a second SUPER_ADMIN", async () => {
    await superAdmin();
    const id = randomUUID();

    await expect(
      prisma.user.create({
        data: {
          id,
          email: `second.super.${id}@example.test`,
          passwordHash: "unused-in-integration-tests",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          name: "Second Super",
        },
      }),
    ).rejects.toThrow();
  });
});
