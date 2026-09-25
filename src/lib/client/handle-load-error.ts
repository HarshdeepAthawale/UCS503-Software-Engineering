import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { httpEntryByStatus } from "@/lib/http/catalog";
import { ApiError } from "./api";

/** Inline feedback is appropriate for form validation and state conflicts. */
const INLINE_LOAD_STATUSES = new Set([400, 409, 422]);

/**
 * When a page's initial data fetch fails, send the member to the matching
 * status screen instead of showing a raw API message in the page chrome.
 */
export function handleLoadError(router: AppRouterInstance, err: unknown): boolean {
  if (!(err instanceof ApiError)) {
    router.replace("/errors/500");
    return true;
  }

  if (err.status === 401) {
    router.replace("/");
    return true;
  }

  if (INLINE_LOAD_STATUSES.has(err.status)) {
    return false;
  }

  if (httpEntryByStatus(err.status)) {
    router.replace(`/errors/${err.status}`);
    return true;
  }

  if (err.status >= 500) {
    router.replace("/errors/500");
    return true;
  }

  return false;
}

export function loadErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
