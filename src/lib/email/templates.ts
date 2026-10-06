import { env } from "@/lib/env";
import type { EmailMessage } from "@/lib/email/mailer";
import { describeNotification, type NotificationLike } from "@/lib/domain/notification-copy";

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
    `${PRODUCT} - verified opportunities for the institute`,
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

export function passwordResetEmail(code: string): Omit<EmailMessage, "to"> {
  return {
    subject: `${code} is your ${PRODUCT} password reset code`,
    text: codeBody(
      `Enter this code to choose a new password for ${PRODUCT}:`,
      code,
      "If you did not ask to reset your password, ignore this message - your password stays the same unless the code is entered.",
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

export function teamInviteEmail(opts: {
  teamName: string;
  hackathon: string;
  leadName: string;
  joinUrl: string;
  inviteCode: string;
  roleLabel: string;
}): Omit<EmailMessage, "to"> {
  const text = [
    `${opts.leadName} invited you to join their hackathon team on ${PRODUCT}.`,
    "",
    `Team: ${opts.teamName}`,
    `Event: ${opts.hackathon}`,
    `Role: ${opts.roleLabel}`,
    "",
    `Team code: ${opts.inviteCode}`,
    `Join link: ${opts.joinUrl}`,
    "",
    "Open the link, sign in with your institute account, and request the role that fits you.",
    "",
    "--",
    `${PRODUCT} - verified opportunities for the institute`,
  ].join("\n");

  return {
    subject: `Join ${opts.teamName} on ${PRODUCT}`,
    text,
  };
}

/**
 * In-app notifications carried out of the app (T-17): one email per delivery,
 * whether that is a single IMMEDIATE event or a DAILY/WEEKLY digest. Wording
 * comes from describeNotification so email and the in-app list always agree.
 * `origin` is the configured public origin; without one, links are left out
 * rather than guessed.
 */
export function notificationEmail(
  items: NotificationLike[],
  origin: string | null,
): Omit<EmailMessage, "to"> {
  const lines = items.map((n) => {
    const { text, href } = describeNotification(n);
    return origin && href ? `- ${text}\n  ${origin}${href}` : `- ${text}`;
  });
  const first = items[0] ? describeNotification(items[0]).text : "";

  return {
    subject: items.length === 1 ? first : `${items.length} updates on ${PRODUCT}`,
    text: [
      items.length === 1 ? "You have an update on your account:" : `You have ${items.length} updates on your account:`,
      "",
      ...lines,
      "",
      origin
        ? `Change how often you hear from us: ${origin}/notifications`
        : "You can change how often you hear from us on the Notifications page.",
      "",
      "--",
      `${PRODUCT} - verified opportunities for the institute`,
    ].join("\n"),
  };
}

/**
 * Sent when the super admin creates an admin account. There is no password to
 * send: the new admin signs in at /admin with a one-time code emailed on
 * request, so nothing secret travels in this message.
 */
export function adminInviteEmail(opts: {
  name: string;
  invitedBy: string;
  origin: string | null;
}): Omit<EmailMessage, "to"> {
  const where = opts.origin ? `${opts.origin}/admin` : `/admin on ${PRODUCT}`;
  return {
    subject: `You are now an administrator on ${PRODUCT}`,
    text: [
      `Hi ${opts.name},`,
      "",
      `${opts.invitedBy} has made you an administrator on ${PRODUCT}.`,
      "",
      `Sign in at ${where}: enter this email address and choose "Email me a code".`,
      "Admin accounts can only sign in there, not on the main page.",
      "",
      "If you were not expecting this, you can ignore this message.",
      "",
      "--",
      `${PRODUCT} - verified opportunities for the institute`,
    ].join("\n"),
  };
}

/** The outcome of an alumni claim, sent to the alumnus. A rejection carries the reviewer's reason. */
export function alumniClaimDecisionEmail(opts: {
  name: string;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  origin: string | null;
}): Omit<EmailMessage, "to"> {
  const site = opts.origin ?? PRODUCT;
  const approved = opts.decision === "APPROVED";
  return {
    subject: approved ? `You're a verified alumnus on ${PRODUCT}` : `Your alumni claim on ${PRODUCT} needs a change`,
    text: [
      `Hi ${opts.name},`,
      "",
      ...(approved
        ? [
            "An administrator has verified your alumni claim. Your account is now active:",
            "you can post opportunities for students and attest their skills.",
            "",
            `Sign in at ${site}.`,
          ]
        : [
            "An administrator could not verify your alumni claim yet.",
            "",
            `Reason: ${opts.reason ?? "Not given."}`,
            "",
            `Sign in at ${site}, correct your details or proof, and submit again.`,
          ]),
      "",
      "--",
      `${PRODUCT} - verified opportunities for the institute`,
    ].join("\n"),
  };
}
