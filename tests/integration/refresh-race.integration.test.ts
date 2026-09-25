import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security/password";
import { hashToken } from "@/lib/security/tokens";
import { login, logout, refresh } from "@/lib/services/auth.service";
import { makeUser } from "./helpers";

vi.mock("@/lib/email/mailer", () => ({ mailer: { send: vi.fn(), configured: true } }));

/**
 * Refresh-token reuse detection must not sign people out for ordinary races:
 * two tabs refreshing at once, or a reload that aborts a refresh after the
 * server rotated the cookie but before the browser stored the new one. A
 * rotated token presented again within a few seconds, while the session still
 * holds a live token, is treated as that race. A replay after the grace
 * window, or after sign-out, is still refused.
 */

const PASSWORD = "Integration-Passw0rd";

async function signedIn() {
  const user = await makeUser("STUDENT");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
  const session = await login({ email: user.email, password: PASSWORD, userAgent: null });
  return { user, raw: session.refresh.raw };
}

async function liveTokens(userId: string) {
  return prisma.refreshToken.count({ where: { userId, revokedAt: null } });
}

describe("refresh token rotation under races", () => {
  it("lets a just-rotated token through once more without ending the session", async () => {
    const { user, raw } = await signedIn();

    const first = await refresh({ rawToken: raw, userAgent: null });
    const second = await refresh({ rawToken: raw, userAgent: null }); // the racing tab / aborted reload

    expect(second.user.id).toBe(user.id);
    expect(second.refresh.raw).not.toBe(first.refresh.raw);
    // Both successors still work - nothing was revoked as theft.
    await expect(refresh({ rawToken: first.refresh.raw, userAgent: null })).resolves.toBeTruthy();
    await expect(refresh({ rawToken: second.refresh.raw, userAgent: null })).resolves.toBeTruthy();
  });

  it("still treats an old rotated token as theft and ends the whole session", async () => {
    const { user, raw } = await signedIn();
    await refresh({ rawToken: raw, userAgent: null });
    // Pretend the rotation happened long ago.
    await prisma.refreshToken.update({
      where: { tokenHash: hashToken(raw) },
      data: { revokedAt: new Date(Date.now() - 10 * 60_000) },
    });

    await expect(refresh({ rawToken: raw, userAgent: null })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await liveTokens(user.id)).toBe(0);
  });

  it("refuses a token after sign-out, even immediately", async () => {
    const { raw } = await signedIn();
    const next = await refresh({ rawToken: raw, userAgent: null });
    await logout(next.refresh.raw);

    await expect(refresh({ rawToken: raw, userAgent: null })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(refresh({ rawToken: next.refresh.raw, userAgent: null })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
