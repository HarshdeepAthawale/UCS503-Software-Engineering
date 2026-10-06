import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { PasswordResetConfirmSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { resetPassword } from "@/lib/services/auth.service";
import { buildRefreshCookie } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/password-reset/confirm - forgot password, step 2.
 * The emailed code plus a new password: sets it, signs out every other
 * session, and signs this person in (access token in the body, rotating
 * refresh token as an HttpOnly cookie).
 */
export const POST = handler(async (req) => {
  if (!(await authRateLimiter.consume(`pwreset-confirm:${clientIp(req)}`))) {
    throw Errors.rateLimited();
  }

  const body = await req.json().catch(() => null);
  const parsed = PasswordResetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const session = await resetPassword({
    email: parsed.data.email,
    otp: parsed.data.otp,
    password: parsed.data.password,
    portal: parsed.data.portal,
    userAgent: req.headers.get("user-agent"),
  });

  const cookie = buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt);
  return ok({ accessToken: session.accessToken, user: session.user }, 200, { "Set-Cookie": cookie });
});
