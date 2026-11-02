"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { PageLoading } from "@/components/page-loading";
import {
  apiListNotifications,
  apiMarkNotificationsRead,
  ApiError,
  bootstrapSession,
  getUser,
  type Notification,
} from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { describeNotification } from "@/lib/domain/notification-copy";
import { SignInRequired } from "@/components/sign-in-required";

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

  if (!ready) return <PageLoading />;
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
                const d = describeNotification(n);
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
