import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { RegisterSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { env } from "@/lib/env";
import { register } from "@/lib/services/auth.service";

// Password hashing (scrypt) requires the Node runtime (not edge).
export const runtime = "nodejs";

/**
 * POST /api/auth/register
 * Domain-restricted student registration. The role is fixed to STUDENT server-side
 * - clients can never choose their own role (prevents privilege escalation).
 * Responds with a uniform 202 whether or not the email already exists, to avoid
 * account enumeration (codeguard-0-authentication-mfa).
 */
export const POST = handler(async (req) => {
  // Rate-limit by IP to blunt automated enumeration/abuse.
  if (!(await authRateLimiter.consume(`register:${clientIp(req)}`))) {
    throw Errors.rateLimited();
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const result = await register({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    role: "STUDENT",
    status: "UNVERIFIED",
  });

  // In dev/test only, surface the OTP so the flow is testable without email.
  // In production the OTP is delivered exclusively by email.
  const devOtp =
    env.NODE_ENV !== "production" && result.otpForDelivery
      ? { devOtp: result.otpForDelivery }
      : {};

  return ok(
    {
      message: "If the address is eligible, a verification code has been sent.",
      ...devOtp,
    },
    202,
  );
});
