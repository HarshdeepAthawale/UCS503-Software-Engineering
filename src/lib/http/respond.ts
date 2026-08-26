import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { AppError, Errors } from "./errors";

/**
 * Response helpers that guarantee a consistent JSON shape and safe headers.
 * `Cache-Control: no-store` is set on every API response so sensitive payloads
 * (tokens, profiles) are never cached (codeguard-0-session-management-and-cookies).
 */

function baseHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Cache-Control", "no-store");
  h.set("Content-Type", "application/json; charset=utf-8");
  return h;
}

export function ok<T>(data: T, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(data, { status, headers: baseHeaders(headers) });
}

export function created<T>(data: T, headers?: HeadersInit): NextResponse {
  return ok(data, 201, headers);
}

export function noContent(headers?: HeadersInit): NextResponse {
  return new NextResponse(null, { status: 204, headers: baseHeaders(headers) });
}

export function fail(err: AppError, requestId = randomUUID()): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: err.message,
        field: err.field,
        requestId,
      },
    },
    { status: err.status, headers: baseHeaders() },
  );
}

/**
 * Wraps a route handler so any thrown AppError becomes a clean envelope and any
 * unexpected error becomes a generic 500 (never leaking internals to the client).
 */
export function handler(
  fn: (req: Request) => Promise<NextResponse>,
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    const requestId = randomUUID();
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof AppError) return fail(e, requestId);
      // Log server-side with the correlation id; return an opaque message.
      console.error(`[${requestId}] unhandled error`, e);
      return fail(Errors.internal(), requestId);
    }
  };
}
