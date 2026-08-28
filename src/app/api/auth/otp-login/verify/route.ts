import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { VerifyOtpSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { verifyLoginOtp } from "@/lib/services/auth.service";
import { buildRefreshCookie } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/otp-login/verify — passwordless login step 2.
 *
 * Verifies the emailed code and issues the SAME rotating session as any login
 * (with faculty-allowlist promotion applied). Reuses VerifyOtpSchema {email, otp}.
 */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = VerifyOtpSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Enter the 6-digit code.");

  const ipOk = await authRateLimiter.consume(`otpverify:ip:${clientIp(req)}`);
  if (!ipOk) throw Errors.rateLimited();

  const session = await verifyLoginOtp({
    email: parsed.data.email,
    otp: parsed.data.otp,
    userAgent: req.headers.get("user-agent"),
  });

  const cookie = buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt);
  return ok(
    { accessToken: session.accessToken, user: session.user },
    200,
    { "Set-Cookie": cookie },
  );
});
