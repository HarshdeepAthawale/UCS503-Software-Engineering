import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { mailer } from "@/lib/email/mailer";
import { passwordResetEmail } from "@/lib/email/templates";
import { PasswordResetRequestSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { requestPasswordReset } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/**
 * POST /api/auth/password-reset/request - forgot password, step 1.
 * Emails a one-time code to an account that may sign in at this door. The
 * response is the same whether or not the account exists - no enumeration.
 */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = PasswordResetRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Enter a valid email address.");

  const ipOk = await authRateLimiter.consume(`pwreset:ip:${clientIp(req)}`);
  const emailOk = await authRateLimiter.consume(`pwreset:email:${parsed.data.email}`);
  if (!ipOk || !emailOk) throw Errors.rateLimited();

  const otp = await requestPasswordReset(parsed.data.email, parsed.data.portal);
  // Logged, never returned: an unknown account never reaches a send, so an
  // error here would disclose which addresses exist.
  if (otp) {
    try {
      await mailer.send({ to: parsed.data.email, ...passwordResetEmail(otp) });
    } catch (e) {
      console.error("[auth/password-reset] reset code failed to send", e);
    }
  }

  return ok({ message: "If that account exists, a reset code has been sent." }, 202);
});
