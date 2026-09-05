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

/**
 * Team browse/discovery feed (T-22). Peer-driven: every STUDENT may lead a
 * team, so unlike the opportunity feed there is no "post" gate here - anyone
 * signed in can start one. Faculty/alumni/admin can view but not join or lead.
 */
export default function TeamsPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [hackathon, setHackathon] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, opts: { reset: boolean; cursor?: string | null } = { reset: true }) => {
    setLoadingMore(true);
    try {
      const res = await apiListTeams({ hackathon: q || undefined, cursor: opts.cursor ?? undefined });
      setTeams((prev) => (opts.reset ? res.teams : [...prev, ...res.teams]));
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load teams.");
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) await load("");
    })();
  }, [load]);

  const user = getUser();
  const canLead = user?.role === "STUDENT";

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

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>Hackathon teams</h1>
              <p className="sub">Find a team recruiting for a hackathon, or start your own.</p>
              {canLead && <Link href="/teams/mine" className="link-quiet">My teams →</Link>}
            </div>
            {canLead && <Link className="btn btn-primary" href="/teams/new">+ Start a team</Link>}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          <div className="panel filter-bar">
            <div className="field" style={{ minWidth: 240 }}>
              <label htmlFor="hackathon">Search by hackathon</label>
              <input
                id="hackathon"
                value={hackathon}
                onChange={(e) => setHackathon(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void load(hackathon); }}
                placeholder="e.g. Smart India Hackathon"
              />
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => void load(hackathon)}>
              Search
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="app-empty">
              <h3>No teams recruiting right now</h3>
              {canLead && <Link className="btn btn-primary" href="/teams/new">Start a team</Link>}
            </div>
          ) : (
            <div className="panel-grid">
              {teams.map((t) => {
                const totalSlots = t.roles.reduce((s, r) => s + r.slotCount, 0);
                const filledSlots = t.roles.reduce((s, r) => s + r.slotsFilled, 0);
                return (
                  <Link key={t.id} href={`/teams/${t.id}`} className="panel-card is-link">
                    <h2>{t.name}</h2>
                    <p className="sub">{t.hackathon}</p>
                    <p className="empty-note" style={{ marginTop: 8 }}>
                      Led by {t.lead.name} · {filledSlots} of {totalSlots} slots filled
                    </p>
                    <div className="skills-current" style={{ marginTop: 8 }}>
                      {t.roles.map((r) => (
                        <span key={r.id} className={`tag${r.skillFit?.matched.length ? " req" : ""}`}>
                          {r.skillFit && r.skillFit.matched.length > 0 && "✔ "}
                          {r.label} · {r.slotsFilled}/{r.slotCount}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {cursor && (
            <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={loadingMore}
                onClick={() => void load(hackathon, { reset: false, cursor })}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
