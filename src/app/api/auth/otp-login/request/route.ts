import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { mailer } from "@/lib/email/mailer";
import { loginCodeEmail } from "@/lib/email/templates";
import { OtpLoginRequestSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { requestLoginOtp } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/**
 * POST /api/auth/otp-login/request - passwordless login step 1.
 *
 * Sends a one-time code to an ACTIVE account (email in prod; returned in dev).
 * The response is uniform whether or not the account exists - no enumeration.
 * The primary path for admin-provisioned alumni (personal email, no password).
 */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = OtpLoginRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Enter a valid email address.");

  const ipOk = await authRateLimiter.consume(`otplogin:ip:${clientIp(req)}`);
  const emailOk = await authRateLimiter.consume(`otplogin:email:${parsed.data.email}`);
  if (!ipOk || !emailOk) throw Errors.rateLimited();

  const otp = await requestLoginOtp(parsed.data.email);

  // Awaited (the function freezes at response time), and failures are logged
  // rather than returned: an unknown account never reaches a send, so an error
  // response here would disclose which addresses exist.
  if (otp) {
    try {
      await mailer.send({ to: parsed.data.email, ...loginCodeEmail(otp) });
    } catch (e) {
      console.error("[auth/otp-login] sign-in code failed to send", e);
    }
  }

  const devOtp =
    env.NODE_ENV !== "production" && otp ? { devOtp: otp } : {};
  return ok(
    { message: "If that account exists, a sign-in code has been sent.", ...devOtp },
    202,
  );
});
