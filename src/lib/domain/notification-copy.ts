/**
 * What a notification says (T-17): one human sentence per type plus a deep link
 * where useful. Shared by the in-app list and the email, so the two can never
 * describe the same event differently. Pure - safe on the client and server.
 */

import { appStateLabel } from "./app-state-label";

export interface NotificationLike {
  type: string;
  payload: unknown;
}

export interface NotificationCopy {
  text: string;
  /** App-relative path, e.g. `/opportunities/<id>/applicants`. */
  href?: string;
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === "string" ? v : undefined;
}

export function describeNotification(n: NotificationLike): NotificationCopy {
  const payload =
    n.payload && typeof n.payload === "object" ? (n.payload as Record<string, unknown>) : {};
  const appId = str(payload, "applicationId");
  const oppId = str(payload, "opportunityId");
  const teamId = str(payload, "teamId");
  // `id && path` is "" or undefined when the payload lacks the id - no link then.
  const link = (href: string | undefined): string | undefined => href || undefined;

  switch (n.type) {
    case "application.received":
      return { text: "A new application arrived on your posting.", href: link(oppId && `/opportunities/${oppId}/applicants`) };
    case "application.status_changed":
      return {
        text: `Your application moved to ${typeof payload.to === "string" ? appStateLabel(payload.to) : "a new stage"}.`,
        href: link(appId && `/applications/${appId}`),
      };
    case "application.withdrawn":
      return { text: "An applicant withdrew from your posting." };
    case "message.received":
      return { text: "You have a new message.", href: link(appId && `/applications/${appId}`) };
    case "opportunity.at_risk":
      return { text: "A posting is at risk - an applicant is waiting past your promised reply time.", href: link(oppId && `/opportunities/${oppId}/applicants`) };
    case "opportunity.deadline_reminder":
      return {
        text:
          payload.tier === "T24"
            ? "A posting closes within 24 hours - review applicants before it expires."
            : "A posting closes within 72 hours - review applicants before it expires.",
        href: link(oppId && `/opportunities/${oppId}/applicants`),
      };
    case "attestation.received":
      return { text: "A poster verified one of your skills - it now shows as attested on your profile.", href: "/profile" };
    case "team.join_requested":
      return { text: "A student requested to join your team.", href: link(teamId && `/teams/${teamId}/requests`) };
    case "team.request_accepted":
      return { text: "Your request to join a team was accepted.", href: link(teamId && `/teams/${teamId}`) };
    case "team.request_rejected":
      return { text: "Your request to join a team was not accepted this time.", href: link(teamId && `/teams/${teamId}`) };
    case "team.locked":
      return { text: "Your team is complete - every role is filled.", href: link(teamId && `/teams/${teamId}`) };
    case "meeting.scheduled":
      return {
        text: payload.reminder ? "Reminder: you have a meeting coming up." : "A Google Meet meeting was scheduled.",
        href: link(appId ? `/applications/${appId}` : teamId && `/teams/${teamId}`),
      };
    case "meeting.cancelled":
      return {
        text: "A scheduled meeting was cancelled.",
        href: link(appId ? `/applications/${appId}` : teamId && `/teams/${teamId}`),
      };
    default:
      return { text: n.type };
  }
}
