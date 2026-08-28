import { describe, expect, it } from "vitest";
import { loginCodeEmail, verificationEmail } from "@/lib/email/templates";

/**
 * These guard the one thing that made the OTP flow silently useless in
 * production: the code being generated and stored but never reaching the body
 * that gets sent. A template that drops the code still renders, still sends,
 * and still looks fine in a screenshot.
 */

const CODE = "042917";

describe("verification email", () => {
  const msg = verificationEmail(CODE);

  it("carries the code in the body", () => {
    expect(msg.text).toContain(CODE);
  });

  it("puts the code in the subject, where clients preview it", () => {
    expect(msg.subject).toContain(CODE);
  });

  it("states an expiry so a stale code is not retried forever", () => {
    expect(msg.text).toMatch(/expires in \d+ minutes/);
  });

  it("tells an unintended recipient that nothing was activated", () => {
    expect(msg.text.toLowerCase()).toContain("did not create an account");
  });
});

describe("sign-in code email", () => {
  const msg = loginCodeEmail(CODE);

  it("carries the code in the body and subject", () => {
    expect(msg.text).toContain(CODE);
    expect(msg.subject).toContain(CODE);
  });

  it("is distinguishable from the verification email", () => {
    // Same six digits arriving twice with one subject line would be ambiguous
    // for the alumni path, where OTP is the ONLY way in.
    expect(msg.subject).not.toBe(verificationEmail(CODE).subject);
  });

  it("does not tell an unintended recipient to ignore it outright", () => {
    // An unexpected sign-in code is worth noticing, unlike an unexpected signup.
    expect(msg.text).toContain("grants no access unless it is entered");
  });
});

describe("leakage", () => {
  it("templates never embed the recipient address", () => {
    // `to` is supplied at send time; a template that interpolated the address
    // would put it in logs the moment a body was logged for debugging.
    const bodies = [verificationEmail(CODE), loginCodeEmail(CODE)];
    for (const b of bodies) {
      expect(b.text).not.toContain("@");
    }
  });
});
