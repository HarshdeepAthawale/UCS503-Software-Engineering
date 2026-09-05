/**
 * Consistent error envelope (docs/Rules.md §4). Error responses expose a stable
 * machine `code` and a human `message` but never internal details, stack traces,
 * or whether a given resource/user exists (codeguard-0-authorization: generic
 * responses avoid leaking existence).
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GONE"
  | "RATE_LIMITED"
  | "DOMAIN_RULE"
  | "INTERNAL";

/** Stable HTTP mapping — the `/errors` page and `AppError.status` share this. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  RATE_LIMITED: 429,
  DOMAIN_RULE: 422,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly field: string | null;

  constructor(code: ErrorCode, message: string, field: string | null = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code];
    this.field = field;
  }
}

export const Errors = {
  validation: (message: string, field: string | null = null) =>
    new AppError("VALIDATION_ERROR", message, field),
  unauthenticated: (message = "Authentication required.") =>
    new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have access to this resource.") =>
    new AppError("FORBIDDEN", message),
  notFound: (message = "Not found.") => new AppError("NOT_FOUND", message),
  conflict: (message: string) => new AppError("CONFLICT", message),
  gone: (message: string) => new AppError("GONE", message),
  rateLimited: (message = "Too many requests. Please slow down.") =>
    new AppError("RATE_LIMITED", message),
  domainRule: (message: string) => new AppError("DOMAIN_RULE", message),
  internal: (message = "Something went wrong.") => new AppError("INTERNAL", message),
} as const;
