"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListMyApplications,
  ApiError,
  bootstrapSession,
  getUser,
  type MyApplication,
} from "@/lib/client/api";
import { deadlineLabel, oppTypeLabel, statusClass, timeAgo, titleCase } from "@/lib/client/format";

export default function ApplicationsPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) {
        try {
          setApps(await apiListMyApplications());
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Could not load your applications.");
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

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main className="app-page">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="page-head">
            <div>
              <h1>My applications</h1>
              <p className="sub">Track every application to a decision - and see when a poster goes quiet.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/opportunities">Browse feed →</Link>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {apps.length === 0 ? (
            <div className="app-empty">
              <h3>No applications yet</h3>
              <p>Find an opportunity and apply - it'll show up here.</p>
              <Link className="btn btn-primary" href="/opportunities">Explore opportunities</Link>
            </div>
          ) : (
            <div className="notif-list">
              {apps.map((a) => (
                <Link key={a.id} href={`/applications/${a.id}`} className="notif">
                  <span className="body">
                    <span className="t">{a.opportunity.title}</span>
                    <span className="when">
                      {oppTypeLabel(a.opportunity.type)} · applied {timeAgo(a.appliedAt)} ·
                      closes {deadlineLabel(a.opportunity.deadline)}
                      {a.rejectionCode ? ` · reason: ${titleCase(a.rejectionCode)}` : ""}
                    </span>
                  </span>
                  <span className={`pill ${statusClass(a.status)}`}>{titleCase(a.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
