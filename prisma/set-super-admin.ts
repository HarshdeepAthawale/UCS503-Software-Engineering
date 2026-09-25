import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";

/**
 * Point the one super admin at a sign-in email and set its password.
 *
 *   npm run super-admin:set -- you@example.com              (production, .env)
 *   npm run super-admin:set:dev -- you@example.com          (local, .env.development.local)
 *
 * The password is typed at a hidden prompt (or read from ADMIN_PASSWORD), so it
 * never lands in shell history, and it must meet the app's password policy.
 *
 * - If no account uses the email, the current super admin simply moves to it
 *   (same account and audit history).
 * - If a member account already uses it, the script stops unless you pass
 *   --take-over: that account becomes the super admin and the previous super
 *   admin account is closed (soft-deleted), since there is only ever one.
 *
 * Every session of the affected accounts is signed out, and the change is
 * written to the audit log.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function strong(p: string): boolean {
  return p.length >= 12 && p.length <= 200 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
}

/** Read a line without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const takeOver = args.includes("--take-over");
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run super-admin:set -- <email> [--take-over]");

  const host = new URL(process.env.DATABASE_URL ?? "postgres://unknown").hostname;
  console.log(`Database: ${host}`);

  const current = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", deletedAt: null }, select: { id: true, email: true } });
  const holder = await prisma.user.findFirst({ where: { email }, select: { id: true, role: true, deletedAt: true } });
  const other = holder && holder.id !== current?.id ? holder : null;
  if (other && !takeOver) {
    throw new Error(
      `${email} already belongs to a ${other.role.toLowerCase()} account here. Re-run with --take-over to make that account the super admin (the old super admin account is closed).`,
    );
  }

  const password = process.env.ADMIN_PASSWORD ?? (await askHidden("New super admin password: "));
  if (!strong(password)) throw new Error("The password needs 12+ characters with upper case, lower case and a digit.");
  if (!process.env.ADMIN_PASSWORD && (await askHidden("Type it again: ")) !== password) throw new Error("The passwords do not match.");
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (other) {
      // One super admin at a time (partial unique index): close the old one first.
      if (current) {
        await tx.user.update({ where: { id: current.id }, data: { role: "ADMIN", deletedAt: now } });
        await tx.refreshToken.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: now } });
      }
      await tx.user.update({ where: { id: other.id }, data: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: other.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({
        data: { actorId: other.id, action: "super_admin.transferred", target: other.id, metadata: { previous: current?.id ?? null } },
      });
    } else if (current) {
      await tx.user.update({ where: { id: current.id }, data: { email, passwordHash, status: "ACTIVE" } });
      await tx.refreshToken.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({
        data: { actorId: current.id, action: "super_admin.credentials_changed", target: current.id, metadata: { emailChanged: current.email !== email } },
      });
    } else {
      const created = await tx.user.create({ data: { email, name: "Super Admin", passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" } });
      await tx.auditLog.create({ data: { actorId: created.id, action: "super_admin.created", target: created.id } });
    }
  });

  console.log(`Done. The super admin signs in as ${email} at /admin. Earlier sessions are signed out.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
