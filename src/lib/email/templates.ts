import { env } from "@/lib/env";
import type { EmailMessage } from "@/lib/email/mailer";

/**
 * Transactional email bodies. Plain text is the primary form - it renders
 * everywhere, cannot leak a tracking pixel, and keeps the code readable when a
 * client strips HTML.
 *
 * The code itself is the only secret here, so these are built at send time and
 * never logged or persisted (the database holds a SHA-256 hash, never this).
 */

const PRODUCT = "Thapar Nexus";

function minutes(): number {
  return env.OTP_TTL_MINUTES;
}

/** Shared shell so both codes read as the same product. */
function codeBody(intro: string, code: string, caution: string): string {
  return [
    intro,
    "",
    `    ${code}`,
    "",
    `This code expires in ${minutes()} minutes and can be used once.`,
    caution,
    "",
    "--",
    `${PRODUCT} - a verified opportunity pipeline for the institute`,
  ].join("\n");
}

export function verificationEmail(code: string): Omit<EmailMessage, "to"> {
  return {
    subject: `${code} is your ${PRODUCT} verification code`,
    text: codeBody(
      `Welcome to ${PRODUCT}. Enter this code to verify your email address:`,
      code,
      "If you did not create an account, you can ignore this message - nothing was activated.",
    ),
  };
}

export function loginCodeEmail(code: string): Omit<EmailMessage, "to"> {
  return {
    subject: `${code} is your ${PRODUCT} sign-in code`,
    text: codeBody(
      `Enter this code to sign in to ${PRODUCT}:`,
      code,
      "If you did not request it, someone may have typed your address by mistake. The code alone grants no access unless it is entered.",
    ),
  };
}
