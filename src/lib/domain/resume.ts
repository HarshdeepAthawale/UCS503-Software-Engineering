/**
 * Résumé upload validation (T-44; docs/PRD M2, "Object Storage").
 *
 * Pure and dependency-free so the accept/reject rule is unit-tested without a
 * network or a database. A résumé is a single PDF, capped so it fits inside the
 * serverless request-body limit and never becomes a storage-abuse vector.
 */

export const RESUME_CONTENT_TYPE = "application/pdf";
/** 4 MB — comfortably under Vercel's ~4.5 MB serverless body limit. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
/** Every real PDF begins with the bytes "%PDF" (0x25 50 44 46). */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

export type ResumeValidationError =
  | "EMPTY"
  | "TOO_LARGE"
  | "WRONG_TYPE"
  | "NOT_A_PDF";

/**
 * Validate a candidate résumé from what the server can cheaply observe: the
 * declared content-type, the byte length, and the leading magic bytes. The
 * magic-byte check defends against a mislabelled or spoofed content-type — a
 * client cannot pass a non-PDF by simply claiming `application/pdf`
 * (codeguard-0-input-validation). Returns null when the file is acceptable.
 */
export function validateResume(input: {
  size: number;
  contentType: string;
  header: Uint8Array; // first bytes of the file (>= 4 recommended)
}): ResumeValidationError | null {
  if (input.size <= 0) return "EMPTY";
  if (input.size > MAX_RESUME_BYTES) return "TOO_LARGE";
  // Content-Type may carry parameters, e.g. "application/pdf; charset=..." —
  // compare only the media type, case-insensitively.
  const mediaType = input.contentType.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== RESUME_CONTENT_TYPE) return "WRONG_TYPE";
  if (!startsWithPdfMagic(input.header)) return "NOT_A_PDF";
  return null;
}

function startsWithPdfMagic(header: Uint8Array): boolean {
  if (header.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((b, i) => header[i] === b);
}

/** Human message for each failure code — surfaced verbatim to the uploader. */
export function resumeErrorMessage(code: ResumeValidationError): string {
  switch (code) {
    case "EMPTY":
      return "The file is empty.";
    case "TOO_LARGE":
      return `The résumé must be at most ${Math.round(MAX_RESUME_BYTES / (1024 * 1024))} MB.`;
    case "WRONG_TYPE":
      return "Only PDF résumés are accepted.";
    case "NOT_A_PDF":
      return "That file is not a valid PDF.";
  }
}
