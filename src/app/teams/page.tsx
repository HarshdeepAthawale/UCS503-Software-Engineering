"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { TeamInviteForm } from "@/components/team-invite-form";
import {
  apiListTeams,
  ApiError,
  bootstrapSession,
  getUser,
  type Team,
} from "@/lib/client/api";
import { statusClass } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { SignInRequired } from "@/components/sign-in-required";

const REQUEST_LABEL: Record<string, string> = {
  PENDING: "Request pending",
  ACCEPTED: "Accepted",
  REJECTED: "Not accepted",
  WITHDRAWN: "Withdrawn",
};

function yourRole(team: Team, userId: string | undefined): string {
  if (!userId) return "—";
  if (team.lead.id === userId) return "Lead";
  if (team.members.some((m) => m.userId === userId)) return "Member";
  const req = team.roles.map((r) => r.myRequest).find((r) => r);
  return req ? REQUEST_LABEL[req.status] ?? req.status : "—";
}

/**
 * Single teams hub — your hackathon teams and open teams to join, one place.
 * There is no separate "My teams" route; everything lives here.
 */
export default function TeamsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [yours, setYours] = useState<Team[]>([]);
  const [discover, setDiscover] = useState<Team[]>([]);
  const [hackathon, setHackathon] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadYours = useCallback(async () => {
    try {
      setYours((await apiListTeams({ mine: true, limit: 100 })).teams);
    } catch (err) {
      if (handleLoadError(router, err)) return;
      setError(loadErrorMessage(err, "Could not load your teams."));
    }
  }, [router]);

  const loadDiscover = useCallback(
    async (q: string, opts: { reset: boolean; cursor?: string | null } = { reset: true }) => {
      setLoadingMore(true);
      try {
        const res = await apiListTeams({
          hackathon: q || undefined,
          cursor: opts.cursor ?? undefined,
        });
        setDiscover((prev) => (opts.reset ? res.teams : [...prev, ...res.teams]));
        setCursor(res.nextCursor);
      } catch (err) {
        if (handleLoadError(router, err)) return;
        setError(loadErrorMessage(err, "Could not load recruiting teams."));
      } finally {
        setLoadingMore(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (!ok) return;
      const user = getUser();
      if (user?.role === "STUDENT") await loadYours();
      await loadDiscover("");
    })();
  }, [loadYours, loadDiscover]);

  const user = getUser();
  const isStudent = user?.role === "STUDENT";

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return <SignInRequired message="Sign in to browse and manage hackathon teams." />;
  }

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>Teams</h1>
              <p className="sub">
                Form a hackathon team, invite friends by email, and track every role slot to lock.
              </p>
            </div>
            {isStudent && <Link className="btn btn-primary" href="/teams/new">+ Start a team</Link>}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {isStudent && (
            <section className="teams-section" aria-labelledby="your-teams-heading">
              <div className="teams-section-head">
                <h2 id="your-teams-heading">Your teams</h2>
                <p className="sub">Teams you lead, belong to, or have asked to join.</p>
              </div>

              {yours.length === 0 ? (
                <div className="app-empty">
                  <h3>No teams yet</h3>
                  <p>Start one with the button above, email invite links to teammates, or request a role below.</p>
                </div>
              ) : (
                <div className="teams-yours-list">
                  {yours.map((t) => {
                    const isLead = t.lead.id === user?.id;
                    const totalSlots = t.roles.reduce((s, r) => s + r.slotCount, 0);
                    const filledSlots = t.roles.reduce((s, r) => s + r.slotsFilled, 0);
                    return (
                      <article key={t.id} className="panel teams-yours-card">
                        <div className="teams-yours-top">
                          <div>
                            <Link href={`/teams/${t.id}`} className="teams-yours-title">{t.name}</Link>
                            <p className="sub">{t.hackathon}</p>
                          </div>
                          <span className={`pill ${statusClass(t.status)}`}>{t.status}</span>
                        </div>
                        <p className="empty-note">
                          {yourRole(t, user?.id)} · {filledSlots} of {totalSlots} slots filled
                        </p>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <Link className="btn btn-ghost btn-sm" href={`/teams/${t.id}`}>Open team</Link>
                          {isLead && t.status === "FORMING" && (
                            <>
                              <Link className="btn btn-ghost btn-sm" href={`/teams/${t.id}/requests`}>
                                Join requests
                              </Link>
                              <TeamInviteForm teamId={t.id} teamName={t.name} roles={t.roles} />
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="teams-section" aria-labelledby="discover-teams-heading">
            <div className="teams-section-head">
              <h2 id="discover-teams-heading">
                {isStudent ? "Teams recruiting" : "Hackathon teams"}
              </h2>
              <p className="sub">
                {isStudent
                  ? "Other students recruiting for hackathons — request a role that fits you."
                  : "Browse student-led hackathon teams (view only)."}
              </p>
            </div>

            <div className="panel filter-bar">
              <div className="field" style={{ minWidth: 240 }}>
                <label htmlFor="hackathon">Filter by hackathon</label>
                <input
                  id="hackathon"
                  value={hackathon}
                  onChange={(e) => setHackathon(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void loadDiscover(hackathon); }}
                  placeholder="e.g. Smart India Hackathon"
                />
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => void loadDiscover(hackathon)}>
                Search
              </button>
            </div>

            {discover.length === 0 ? (
              <div className="app-empty">
                <h3>No teams recruiting right now</h3>
                <p>Try another hackathon name, or start your own team from the button above.</p>
              </div>
            ) : (
              <div className="panel-grid">
                {discover.map((t) => {
                  const totalSlots = t.roles.reduce((s, r) => s + r.slotCount, 0);
                  const filledSlots = t.roles.reduce((s, r) => s + r.slotsFilled, 0);
                  const alreadyInvolved = yours.some((y) => y.id === t.id);
                  return (
                    <Link key={t.id} href={`/teams/${t.id}`} className="panel-card is-link">
                      <h3>{t.name}</h3>
                      <p className="sub">{t.hackathon}</p>
                      <p className="empty-note" style={{ marginTop: 8 }}>
                        Led by {t.lead.name} · {filledSlots} of {totalSlots} slots filled
                        {alreadyInvolved ? " · You are already on this team" : ""}
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
                  onClick={() => void loadDiscover(hackathon, { reset: false, cursor })}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
