import { describe, it, expect } from "vitest";
import { describeNotification } from "@/lib/domain/notification-copy";
import { notificationEmail } from "@/lib/email/templates";

/** What a notification says, in-app and by email (T-17). */

describe("describeNotification", () => {
  it("deep-links an at-risk nudge to the posting's applicants", () => {
    expect(describeNotification({ type: "opportunity.at_risk", payload: { opportunityId: "o1" } })).toEqual({
      text: "A posting is at risk - an applicant is waiting past your promised reply time.",
      href: "/opportunities/o1/applicants",
    });
  });
  it("falls back to the raw type for an unknown notification", () => {
    expect(describeNotification({ type: "something.new", payload: {} })).toEqual({ text: "something.new" });
  });
});

describe("notificationEmail", () => {
  const atRisk = { type: "opportunity.at_risk", payload: { opportunityId: "o1" } };
  const received = { type: "application.received", payload: { opportunityId: "o2" } };
  const withdrawn = { type: "application.withdrawn", payload: {} };

  it("uses the one sentence as the subject for a single notification", () => {
    const mail = notificationEmail([atRisk], "https://nexus.example.edu");
    expect(mail.subject).toBe("A posting is at risk - an applicant is waiting past your promised reply time.");
    expect(mail.text).toContain("https://nexus.example.edu/opportunities/o1/applicants");
  });

  it("batches a digest into one message listing every update", () => {
    const mail = notificationEmail([atRisk, received, withdrawn], "https://nexus.example.edu");
    expect(mail.subject).toBe("3 updates on Thapar Nexus");
    expect(mail.text).toContain("A posting is at risk");
    expect(mail.text).toContain("A new application arrived on your posting.");
    expect(mail.text).toContain("An applicant withdrew from your posting.");
  });

  it("omits links rather than printing a broken one when the origin is unknown", () => {
    const mail = notificationEmail([atRisk], null);
    expect(mail.text).not.toContain("undefined");
    expect(mail.text).not.toContain("/opportunities/o1");
  });
});
