import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { mailer } from "@/lib/email/mailer";
import { verificationEmail } from "@/lib/email/templates";
import { AlumniRegisterSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { register } from "@/lib/services/auth.service";

// Password hashing (scrypt) requires the Node runtime (not edge).
export const runtime = "nodejs";

/**
 * POST /api/auth/register-alumni
 * Alumni lose their institute email, so they register with any address. The
 * role is fixed to ALUMNI server-side and the account starts UNVERIFIED; once
 * the emailed code is confirmed it becomes PENDING_ALUMNI (read-only) until an
 * admin approves their alumni claim (docs/PRD §4.5). Uniform 202 whether or
 * not the email exists, like student registration (no account enumeration).
 */
export const POST = handler(async (req) => {
  if (!(await authRateLimiter.consume(`register:${clientIp(req)}`))) {
    throw Errors.rateLimited();
  }

  const body = await req.json().catch(() => null);
  const parsed = AlumniRegisterSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const result = await register({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    role: "ALUMNI",
    status: "UNVERIFIED",
  });

  // Logged, never returned: a send failure must not become an enumeration
  // oracle (see /api/auth/register).
  if (result.otpForDelivery) {
    try {
      await mailer.send({ to: parsed.data.email, ...verificationEmail(result.otpForDelivery) });
    } catch (e) {
      console.error("[auth/register-alumni] verification email failed to send", e);
    }
  }

  return ok({ message: "If the address is eligible, a verification code has been sent." }, 202);
});
