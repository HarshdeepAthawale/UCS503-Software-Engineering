import { afterEach, describe, expect, it, vi } from "vitest";
import { createMailer, parseSender } from "@/lib/email/mailer";

/**
 * The Brevo request shape and when email is considered configured. `fetch`
 * is stubbed - these tests never send a real email.
 */

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status = 201) {
  const fetchMock = vi.fn(async () => new Response(status < 300 ? '{"messageId":"m"}' : '{"message":"bad"}', { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const msg = { to: "someone@example.test", subject: "Hi", text: "Body" };

describe("parseSender", () => {
  it("reads a display name and address, or a bare address", () => {
    expect(parseSender("Thapar Nexus <nexus@example.test>")).toEqual({ name: "Thapar Nexus", email: "nexus@example.test" });
    expect(parseSender("nexus@example.test")).toEqual({ email: "nexus@example.test" });
  });
});

describe("createMailer", () => {
  it("sends through Brevo with the api-key header and Brevo's payload", async () => {
    const fetchMock = stubFetch();
    const mailer = createMailer({ BREVO_API_KEY: "brevo-key", EMAIL_FROM: "Thapar Nexus <sender@example.test>" });
    expect(mailer.configured).toBe(true);
    await mailer.send(msg);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("brevo-key");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "Thapar Nexus", email: "sender@example.test" },
      to: [{ email: "someone@example.test" }],
      subject: "Hi",
      textContent: "Body",
    });
  });

  it("throws, without the provider's reason, when Brevo refuses", async () => {
    stubFetch(400);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createMailer({ BREVO_API_KEY: "k", EMAIL_FROM: "from@example.test" }).send(msg)).rejects.toThrow(
      "Email provider returned 400",
    );
    quiet.mockRestore();
  });

  it("is unconfigured without both the key and a sender", () => {
    expect(createMailer({ BREVO_API_KEY: "", EMAIL_FROM: "a@example.test" }).configured).toBe(false);
    expect(createMailer({ BREVO_API_KEY: "k" }).configured).toBe(false);
  });
});
