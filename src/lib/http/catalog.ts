import { ERROR_HTTP_STATUS, type ErrorCode } from "./errors";

/**
 * Member-facing catalogue of every HTTP status this app actually emits.
 * Machine `code` values match the JSON error envelope (`{ error: { code } }`).
 */
export type HttpCatalogKind = "success" | "error";

export interface HttpCatalogEntry {
  status: number;
  code: ErrorCode | "OK" | "CREATED" | "NO_CONTENT";
  title: string;
  meaning: string;
  when: string;
  kind: HttpCatalogKind;
}

export const HTTP_SUCCESS: HttpCatalogEntry[] = [
  {
    status: 200,
    code: "OK",
    title: "OK",
    meaning: "The request succeeded and a body is returned.",
    when: "Reads (profiles, postings, pipelines) and updates that return the new record.",
    kind: "success",
  },
  {
    status: 201,
    code: "CREATED",
    title: "Created",
    meaning: "A new resource exists.",
    when: "Publishing a posting, applying, sending a first message, provisioning alumni.",
    kind: "success",
  },
  {
    status: 204,
    code: "NO_CONTENT",
    title: "No content",
    meaning: "The request succeeded and there is nothing to show.",
    when: "Deletes and some acknowledgements (sign-out, remove a skill).",
    kind: "success",
  },
];

export const HTTP_ERRORS: HttpCatalogEntry[] = [
  {
    status: ERROR_HTTP_STATUS.VALIDATION_ERROR,
    code: "VALIDATION_ERROR",
    title: "Bad request",
    meaning: "The payload failed a field check (type, length, format).",
    when: "A form is incomplete or a value is out of range — CGPA, deadline, URL.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.UNAUTHENTICATED,
    code: "UNAUTHENTICATED",
    title: "Sign in required",
    meaning: "No valid session. The API does not say whether the account exists.",
    when: "The access token expired and refresh failed, or the page needs a member.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.FORBIDDEN,
    code: "FORBIDDEN",
    title: "Not allowed",
    meaning: "You are signed in, but this role cannot do that. Deny-by-default RBAC.",
    when: "A student tries to post; a poster edits someone else's opportunity; admin-only console.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.NOT_FOUND,
    code: "NOT_FOUND",
    title: "Not found",
    meaning: "No resource at this URL — or it is hidden so existence is not leaked.",
    when: "A posting id is wrong, a profile is gone, or a route was never defined.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.CONFLICT,
    code: "CONFLICT",
    title: "Conflict",
    meaning: "The request is well-formed but collides with current state.",
    when: "Double-apply, application budget full, duplicate flag, email already registered.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.GONE,
    code: "GONE",
    title: "Gone",
    meaning: "The resource existed and is no longer available.",
    when: "A posting expired or was closed; new applications are refused.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.DOMAIN_RULE,
    code: "DOMAIN_RULE",
    title: "Domain rule",
    meaning: "A pipeline invariant rejected the action (not a syntax error).",
    when: "Illegal application transition, attestation without SELECTED, ineligible branch/CGPA.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.RATE_LIMITED,
    code: "RATE_LIMITED",
    title: "Too many requests",
    meaning: "This endpoint is throttled to slow brute force and spam.",
    when: "Repeated login, OTP, or register attempts from one place.",
    kind: "error",
  },
  {
    status: ERROR_HTTP_STATUS.INTERNAL,
    code: "INTERNAL",
    title: "Something went wrong",
    meaning: "An unexpected failure. The body never includes a stack trace.",
    when: "The server hit an unhandled exception. Retry; if it persists, it is on us.",
    kind: "error",
  },
];

export const HTTP_CATALOG: HttpCatalogEntry[] = [...HTTP_SUCCESS, ...HTTP_ERRORS];

export function httpEntryByStatus(status: number): HttpCatalogEntry | undefined {
  return HTTP_CATALOG.find((e) => e.status === status);
}

export function requireHttpEntry(status: number): HttpCatalogEntry {
  const entry = httpEntryByStatus(status);
  if (!entry) {
    throw new Error(`HTTP catalogue has no row for ${status}`);
  }
  return entry;
}
