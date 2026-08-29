import { describe, it, expect } from "vitest";
import { validateResume, MAX_RESUME_BYTES } from "@/lib/domain/resume";

/** Résumé upload validation (T-44; docs/PRD M2). Pure, no network/DB. */

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("validateResume", () => {
  it("accepts a well-formed PDF within the size cap", () => {
    expect(
      validateResume({ size: 100_000, contentType: "application/pdf", header: PDF_HEADER }),
    ).toBeNull();
  });

  it("tolerates a content-type with parameters", () => {
    expect(
      validateResume({
        size: 100_000,
        contentType: "application/pdf; charset=binary",
        header: PDF_HEADER,
      }),
    ).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(
      validateResume({ size: 0, contentType: "application/pdf", header: PDF_HEADER }),
    ).toBe("EMPTY");
  });

  it("rejects a file over the size cap", () => {
    expect(
      validateResume({
        size: MAX_RESUME_BYTES + 1,
        contentType: "application/pdf",
        header: PDF_HEADER,
      }),
    ).toBe("TOO_LARGE");
  });

  it("rejects a non-PDF content-type", () => {
    expect(
      validateResume({ size: 100_000, contentType: "image/png", header: PNG_HEADER }),
    ).toBe("WRONG_TYPE");
  });

  it("rejects a PDF-labelled file whose bytes are not a PDF (spoofed type)", () => {
    expect(
      validateResume({ size: 100_000, contentType: "application/pdf", header: PNG_HEADER }),
    ).toBe("NOT_A_PDF");
  });

  it("rejects a header shorter than the magic sequence", () => {
    expect(
      validateResume({
        size: 3,
        contentType: "application/pdf",
        header: new Uint8Array([0x25, 0x50, 0x44]),
      }),
    ).toBe("NOT_A_PDF");
  });
});
