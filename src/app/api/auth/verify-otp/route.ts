import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { VerifyOtpSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { verifyRegistrationOtp } from "@/lib/services/auth.service";
import { buildRefreshCookie } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/verify-otp
 * Confirms the emailed code and, on success, issues an access token (body) and a
 * rotating refresh token (HttpOnly cookie). Uniform generic failures — never
 * disclose whether the email or the code was the wrong part.
 */
export const POST = handler(async (req) => {
  if (!(await authRateLimiter.consume(`verify:${clientIp(req)}`))) {
    throw Errors.rateLimited();
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyOtpSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Enter your email and the 6-digit code.");

  const session = await verifyRegistrationOtp({
    email: parsed.data.email,
    otp: parsed.data.otp,
    userAgent: req.headers.get("user-agent"),
  });

  const cookie = buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt);
  return ok(
    {
      accessToken: session.accessToken,
      user: session.user,
    },
    200,
    { "Set-Cookie": cookie },
  );
});
