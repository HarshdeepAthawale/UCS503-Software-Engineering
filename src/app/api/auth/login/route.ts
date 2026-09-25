import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { LoginSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { login } from "@/lib/services/auth.service";
import { buildRefreshCookie } from "@/lib/security/cookies";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 * Rate-limited by both IP and email to slow credential stuffing. Returns a
 * generic "Invalid email or password" for every credential failure.
 */
export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Enter your email and password.");

  const ipKey = `login:ip:${clientIp(req)}`;
  const emailKey = `login:email:${parsed.data.email}`;
  const [ipOk, emailOk] = await Promise.all([
    authRateLimiter.consume(ipKey),
    authRateLimiter.consume(emailKey),
  ]);
  if (!ipOk || !emailOk) throw Errors.rateLimited();

  const session = await login({
    email: parsed.data.email,
    password: parsed.data.password,
    userAgent: req.headers.get("user-agent"),
    portal: parsed.data.portal,
  });

  const cookie = buildRefreshCookie(session.refresh.raw, session.refresh.expiresAt);
  return ok(
    { accessToken: session.accessToken, user: session.user },
    200,
    { "Set-Cookie": cookie },
  );
});
