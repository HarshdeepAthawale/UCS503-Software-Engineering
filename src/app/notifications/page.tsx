"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListNotifications,
  apiMarkNotificationsRead,
  ApiError,
  bootstrapSession,
  getUser,
  type Notification,
} from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { SignInRequired } from "@/components/sign-in-required";

// Human sentences for each notification type + a deep link where useful.
function describe(n: Notification): { text: string; href?: string } {
  const appId = typeof n.payload.applicationId === "string" ? n.payload.applicationId : undefined;
  const oppId = typeof n.payload.opportunityId === "string" ? n.payload.opportunityId : undefined;
  const teamId = typeof n.payload.teamId === "string" ? n.payload.teamId : undefined;
  switch (n.type) {
    case "application.received":
      return { text: "A new application arrived on your posting.", href: oppId ? `/opportunities/${oppId}/applicants` : undefined };
    case "application.status_changed":
      return { text: `Your application moved to ${String(n.payload.to ?? "a new stage")}.`, href: appId ? `/applications/${appId}` : undefined };
    case "application.withdrawn":
      return { text: "An applicant withdrew from your posting." };
    case "message.received":
      return { text: "You have a new message.", href: appId ? `/applications/${appId}` : undefined };
    case "opportunity.at_risk":
      return { text: "A posting is at risk - an applicant is waiting past your SLA.", href: oppId ? `/opportunities/${oppId}/applicants` : undefined };
    case "opportunity.deadline_reminder":
      return { text: n.payload.tier === "T24" ? "A posting closes within 24 hours - review applicants before it expires." : "A posting closes within 72 hours - review applicants before it expires.", href: oppId ? `/opportunities/${oppId}/applicants` : undefined };
    case "attestation.received":
      return { text: "A poster verified one of your skills - it now shows as attested on your profile.", href: "/profile" };
    case "team.join_requested":
      return { text: "A student requested to join your team.", href: teamId ? `/teams/${teamId}/requests` : undefined };
    case "team.request_accepted":
      return { text: "Your request to join a team was accepted.", href: teamId ? `/teams/${teamId}` : undefined };
    case "team.request_rejected":
      return { text: "Your request to join a team was not accepted this time.", href: teamId ? `/teams/${teamId}` : undefined };
    case "team.locked":
      return { text: "Your team is complete - every role is filled.", href: teamId ? `/teams/${teamId}` : undefined };
    case "meeting.scheduled": {
      const href = appId ? `/applications/${appId}` : teamId ? `/teams/${teamId}` : undefined;
      return { text: n.payload.reminder ? "Reminder: you have a meeting coming up." : "A Google Meet meeting was scheduled.", href };
    }
    case "meeting.cancelled": {
      const href = appId ? `/applications/${appId}` : teamId ? `/teams/${teamId}` : undefined;
      return { text: "A scheduled meeting was cancelled.", href };
    }
    default:
      return { text: n.type };
  }
}

export default function NotificationsPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await apiListNotifications();
    setItems(res.notifications);
    setUnread(res.unread);
  }

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (!ok) return;
      try {
        await refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load notifications.");
      }
    })();
  }, []);

  async function markAll() {
    try {
      await apiMarkNotificationsRead();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update.");
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return <SignInRequired message="Sign in to view your notifications." />;
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} unread={unread} />
      <main id="content" className="app-page">
        <div className="wrap wrap-medium">
          <div className="page-head">
            <div>
              <h1>Notifications</h1>
              <p className="sub">{unread} unread</p>
            </div>
            <div className="nav-cta">
              {unread > 0 && <button className="btn btn-ghost btn-sm" type="button" onClick={() => void markAll()}>Mark all read</button>}
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {items.length === 0 ? (
            <div className="app-empty"><h3>Nothing yet</h3><p>Updates on your applications and postings show up here.</p></div>
          ) : (
            <div className="notif-list">
              {items.map((n) => {
                const d = describe(n);
                const unreadRow = !n.readAt;
                const inner = (
                  <>
                    <span className={`dot${unreadRow ? "" : " read"}`} />
                    <span className="body">
                      <span className="t">{d.text}</span>
                      <span className="when">{timeAgo(n.createdAt)}</span>
                    </span>
                  </>
                );
                return d.href ? (
                  <Link key={n.id} href={d.href} className={`notif${unreadRow ? " unread" : ""}`}>{inner}</Link>
                ) : (
                  <div key={n.id} className={`notif${unreadRow ? " unread" : ""}`}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
