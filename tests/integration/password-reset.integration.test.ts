import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { login, requestPasswordReset, resetPassword } from "@/lib/services/auth.service";
import { hashPassword } from "@/lib/security/password";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * Forgot password: an emailed code lets a member choose a new password. It
 * signs out every other session, and never reveals whether an email exists.
 */

const OLD = "OldPassword123";
const NEW = "BrandNewPass456";

async function member(role: "FACULTY" | "ALUMNI" | "ADMIN", status: "ACTIVE" | "PENDING_ALUMNI" | "SUSPENDED" = "ACTIVE") {
  const email = `${role.toLowerCase()}.${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: `Reset ${role}`, role, status, passwordHash: await hashPassword(OLD) },
  });
  return { ...user, email };
}

describe("password reset", () => {
  it("sets a new password with the emailed code, and signs out every other session", async () => {
    const u = await member("FACULTY");
    const before = await login({ email: u.email, password: OLD, userAgent: null });

    const code = await requestPasswordReset(u.email);
    expect(code).toMatch(/^\d{6}$/);
    const session = await resetPassword({ email: u.email, otp: code!, password: NEW, userAgent: null });
    expect(session.user.id).toBe(u.id);

    await expect(login({ email: u.email, password: OLD, userAgent: null })).rejects.toMatchObject({ status: 401 });
    await expect(login({ email: u.email, password: NEW, userAgent: null })).resolves.toBeTruthy();
    // The session from before the reset is revoked.
    const old = await prisma.refreshToken.findFirst({ where: { userId: u.id, createdAt: { lte: new Date() } }, orderBy: { createdAt: "asc" } });
    expect(old?.revokedAt).not.toBeNull();
    expect(before.user.id).toBe(u.id);

    // A code works once.
    await expect(resetPassword({ email: u.email, otp: code!, password: "AnotherPass789", userAgent: null })).rejects.toMatchObject({ status: 400 });
  });

  it("works for an alumnus still awaiting verification", async () => {
    const u = await member("ALUMNI", "PENDING_ALUMNI");
    const code = await requestPasswordReset(u.email);
    expect(code).toBeTruthy();
    const session = await resetPassword({ email: u.email, otp: code!, password: NEW, userAgent: null });
    expect(session.user.status).toBe("PENDING_ALUMNI");
  });

  it("refuses a wrong code, a weak password is the route's job, and the code counts attempts", async () => {
    const u = await member("FACULTY");
    const code = await requestPasswordReset(u.email);
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(resetPassword({ email: u.email, otp: wrong, password: NEW, userAgent: null })).rejects.toMatchObject({ status: 400 });
    const ch = await prisma.otpChallenge.findFirstOrThrow({ where: { userId: u.id, purpose: "PASSWORD_RESET" } });
    expect(ch.attempts).toBe(1);
  });

  it("sends nothing for an unknown, suspended, or wrong-door account", async () => {
    expect(await requestPasswordReset(`nobody.${randomUUID()}@example.test`)).toBeNull();
    expect(await requestPasswordReset((await member("FACULTY", "SUSPENDED")).email)).toBeNull();
    const admin = await member("ADMIN");
    expect(await requestPasswordReset(admin.email, "member")).toBeNull();
    expect(await requestPasswordReset(admin.email, "admin")).toMatch(/^\d{6}$/);
  });
});
