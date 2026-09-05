"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListMyThreads,
  ApiError,
  bootstrapSession,
  getUser,
  type MessageThreadSummary,
} from "@/lib/client/api";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";

export default function MessagesPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) {
        try {
          setThreads(await apiListMyThreads());
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Could not load your conversations.");
        }
      }
    })();
  }, []);

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

  const me = getUser();
  const isStudent = me?.role === "STUDENT";

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="page-head">
            <div>
              <h1>Messages</h1>
              <p className="sub">
                {isStudent
                  ? "Every conversation you've had with a professor, across all your applications."
                  : "Every conversation with an applicant, across all your postings."}
              </p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {threads.length === 0 ? (
            <div className="app-empty">
              <h3>No conversations yet</h3>
              <p>
                {isStudent
                  ? "Message a professor from one of your applications and it'll show up here."
                  : "Message an applicant from your applicant pipeline and it'll show up here."}
              </p>
            </div>
          ) : (
            <div className="notif-list">
              {threads.map((t) => (
                <Link key={t.applicationId} href={`/applications/${t.applicationId}`} className="notif">
                  <span className="body">
                    <span className="t">
                      {t.counterpart.name}
                      {isStudent && t.counterpart.role === "FACULTY" ? " (Faculty)" : ""}
                    </span>
                    <span className="when">
                      {t.opportunity.title} · {t.lastMessage.senderId === me?.id ? "You: " : ""}
                      {t.lastMessage.body.length > 80
                        ? `${t.lastMessage.body.slice(0, 80)}…`
                        : t.lastMessage.body}
                      {" · "}
                      {timeAgo(t.lastMessage.createdAt)}
                    </span>
                  </span>
                  <span className={`pill ${statusClass(t.status)}`}>{titleCase(t.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
