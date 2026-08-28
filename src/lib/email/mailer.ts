import { env } from "@/lib/env";

/**
 * Outbound email seam (docs/Tracker.md D-13: "email is a future seam").
 *
 * One `Mailer` interface with a provider behind it, so call sites never learn
 * which service is in use. Swapping Resend for SMTP or SES means adding one
 * adapter, not touching auth.
 *
 * Delivery is ALWAYS awaited. On Vercel the function is frozen the moment the
 * response is returned, so a fire-and-forget send is silently dropped - the
 * exact failure this module exists to prevent.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always sent - some institute clients strip HTML. */
  text: string;
  html?: string;
}

export interface Mailer {
  /** Resolves on accepted-for-delivery; throws on a provider failure. */
  send(msg: EmailMessage): Promise<void>;
  /** False when the provider has no credentials - callers can fail loudly. */
  readonly configured: boolean;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend over its HTTP API - deliberately `fetch`, not SMTP. A serverless
 * invocation is too short-lived to make an SMTP handshake reliable, and an
 * HTTP call needs no native dependency (the same constraint that put scrypt in
 * place of Argon2 - see docs/Tracker.md D-17).
 */
class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  get configured(): boolean {
    return true;
  }

  async send(msg: EmailMessage): Promise<void> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });

    if (!res.ok) {
      // Read the provider's reason for the server log, but never re-throw it to
      // the client: it echoes the recipient address and would turn a failed
      // send into an account-enumeration oracle.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend rejected the send (${res.status}): ${detail}`);
      throw new Error(`Email provider returned ${res.status}`);
    }
  }
}

/**
 * Stands in when no provider is configured. It refuses rather than pretending,
 * because the alternative is what shipped before this module existed: the UI
 * claimed "a verification code has been sent" while the code was generated,
 * hashed, stored, and then dropped.
 *
 * Outside production it logs the message so the flow stays testable offline.
 */
class UnconfiguredMailer implements Mailer {
  get configured(): boolean {
    return false;
  }

  async send(msg: EmailMessage): Promise<void> {
    if (env.NODE_ENV === "production") {
      throw new Error("No email provider is configured (set RESEND_API_KEY).");
    }
    console.warn(
      `[email] No provider configured; not sent.\n  to: ${msg.to}\n  subject: ${msg.subject}\n${msg.text}`,
    );
  }
}

function createMailer(): Mailer {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new UnconfiguredMailer();
}

export const mailer: Mailer = createMailer();
