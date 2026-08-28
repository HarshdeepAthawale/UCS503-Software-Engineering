"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiGetNotificationPref,
  apiListNotifications,
  apiMarkNotificationsRead,
  apiSetNotificationPref,
  ApiError,
  bootstrapSession,
  getUser,
  type NotifFreq,
  type Notification,
} from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";

const FREQS: { value: NotifFreq; label: string }[] = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "DAILY", label: "Daily digest" },
  { value: "WEEKLY", label: "Weekly digest" },
];

// Human sentences for each notification type + a deep link where useful.
function describe(n: Notification): { text: string; href?: string } {
  const appId = typeof n.payload.applicationId === "string" ? n.payload.applicationId : undefined;
  const oppId = typeof n.payload.opportunityId === "string" ? n.payload.opportunityId : undefined;
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
      return { text: "A posting is at risk — an applicant is waiting past your SLA.", href: oppId ? `/opportunities/${oppId}/applicants` : undefined };
    default:
      return { text: n.type };
  }
}

export default function NotificationsPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [freq, setFreq] = useState<NotifFreq>("DAILY");
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
        setFreq((await apiGetNotificationPref()).frequency);
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

  async function changeFreq(next: NotifFreq) {
    setFreq(next);
    try {
      await apiSetNotificationPref(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save preference.");
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card"><h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/login">Sign in</Link></div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} unread={unread} />
      <main className="app-page">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="page-head">
            <div>
              <h1>Notifications</h1>
              <p className="sub">{unread} unread · your digest cadence controls batched delivery.</p>
            </div>
            <div className="nav-cta">
              <select aria-label="Digest cadence" value={freq} onChange={(e) => void changeFreq(e.target.value as NotifFreq)}
                style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)", borderRadius: 10, padding: "8px 12px", fontFamily: "inherit" }}>
                {FREQS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
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
