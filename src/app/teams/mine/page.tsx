"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListTeams,
  ApiError,
  bootstrapSession,
  getUser,
  type Team,
} from "@/lib/client/api";
import { statusClass } from "@/lib/client/format";

const REQUEST_LABEL: Record<string, string> = {
  PENDING: "Applicant (pending)",
  ACCEPTED: "Applicant (accepted)",
  REJECTED: "Applicant (rejected)",
  WITHDRAWN: "Applicant (withdrawn)",
};

/** "My Teams" - every team the caller leads, has joined, or has requested to join (any status). */
export default function MyTeamsPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeams((await apiListTeams({ mine: true, limit: 100 })).teams);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your teams.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) await load();
    })();
  }, [load]);

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>My teams</h1>
              <p className="sub">Every team you lead, have joined, or have requested to join.</p>
            </div>
            {user?.role === "STUDENT" && <Link className="btn btn-primary" href="/teams/new">+ Start a team</Link>}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {teams.length === 0 ? (
            <div className="app-empty">
              <h3>No teams yet</h3>
              <Link className="btn btn-ghost" href="/teams">Browse teams</Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Hackathon</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => {
                    const isLead = t.lead.id === user?.id;
                    const isMember = t.members.some((m) => m.userId === user?.id);
                    const myRequest = t.roles.map((r) => r.myRequest).find((r) => r);
                    const roleLabel = isLead ? "Lead" : isMember ? "Member" : myRequest ? REQUEST_LABEL[myRequest.status] : "—";
                    return (
                      <tr key={t.id}>
                        <td><Link href={`/teams/${t.id}`}>{t.name}</Link></td>
                        <td>{t.hackathon}</td>
                        <td>{roleLabel}</td>
                        <td><span className={`pill ${statusClass(t.status)}`}>{t.status}</span></td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            {isLead && (
                              <Link className="mini solid" href={`/teams/${t.id}/requests`}>Requests</Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
