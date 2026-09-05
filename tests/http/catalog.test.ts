import { describe, expect, it } from "vitest";
import { ERROR_HTTP_STATUS, type ErrorCode } from "@/lib/http/errors";
import { HTTP_CATALOG, HTTP_ERRORS, httpEntryByStatus } from "@/lib/http/catalog";

describe("HTTP catalogue", () => {
  it("covers every AppError code at the mapped status", () => {
    const codes = Object.keys(ERROR_HTTP_STATUS) as ErrorCode[];
    for (const code of codes) {
      const row = HTTP_ERRORS.find((e) => e.code === code);
      expect(row, code).toBeDefined();
      expect(row?.status).toBe(ERROR_HTTP_STATUS[code]);
    }
  });

  it("looks up each listed status uniquely", () => {
    const statuses = HTTP_CATALOG.map((e) => e.status);
    expect(new Set(statuses).size).toBe(statuses.length);
    for (const status of statuses) {
      expect(httpEntryByStatus(status)?.status).toBe(status);
    }
  });
});
