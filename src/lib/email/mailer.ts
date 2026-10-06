import { env } from "@/lib/env";

/**
 * Outbound email seam (docs/Tracker.md D-13: "email is a future seam").
 *
 * One `Mailer` interface with a provider behind it, so call sites never learn
 * which service is in use. The provider is Brevo; swapping it means adding one
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

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** "Name <address>" or a bare address, as a Brevo sender. */
export function parseSender(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/);
  if (m && m[1]) return { name: m[1].replace(/^"|"$/g, ""), email: m[2]! };
  return { email: (m ? m[2]! : from).trim() };
}

/**
 * Brevo's transactional email API over its HTTP API - deliberately `fetch`,
 * not SMTP. A serverless invocation is too short-lived to make an SMTP
 * handshake reliable, and an HTTP call needs no native dependency (the same
 * constraint that put scrypt in place of Argon2 - see docs/Tracker.md D-17).
 * The sender (EMAIL_FROM) must be an address verified in the Brevo account.
 */
class BrevoMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  get configured(): boolean {
    return true;
  }

  async send(msg: EmailMessage): Promise<void> {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [{ email: msg.to }],
        subject: msg.subject,
        textContent: msg.text,
        ...(msg.html ? { htmlContent: msg.html } : {}),
      }),
    });

    if (!res.ok) {
      // Read the provider's reason for the server log, but never re-throw it to
      // the client: it echoes the recipient address and would turn a failed
      // send into an account-enumeration oracle.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Brevo rejected the send (${res.status}): ${detail}`);
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
      throw new Error("No email provider is configured (set BREVO_API_KEY and EMAIL_FROM).");
    }
    console.warn(
      `[email] No provider configured; not sent.\n  to: ${msg.to}\n  subject: ${msg.subject}\n${msg.text}`,
    );
  }
}

interface MailConfig {
  BREVO_API_KEY?: string;
  /** The verified Brevo sender, e.g. "Thapar Nexus <you@gmail.com>". */
  EMAIL_FROM?: string;
}

/** Brevo when it is configured, otherwise the logging stand-in. */
export function createMailer(config: MailConfig = env): Mailer {
  if (config.BREVO_API_KEY && config.EMAIL_FROM) return new BrevoMailer(config.BREVO_API_KEY, config.EMAIL_FROM);
  return new UnconfiguredMailer();
}

export const mailer: Mailer = createMailer();
