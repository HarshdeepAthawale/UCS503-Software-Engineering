"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { HackathonFilter } from "@/components/hackathon-filter";
import { TeamInviteForm } from "@/components/team-invite-form";
import { TeamLeadInbox } from "@/components/team-lead-inbox";
import { TeamRecruitCard } from "@/components/team-recruit-card";
import { TeamsHowItWorks } from "@/components/teams-how-it-works";
import {
  apiListTeams,
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

export default function TeamsPage() {
  const router = useRouter();
  const joinRef = useRef<HTMLElement>(null);
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
  const leadTeams = yours.filter((t) => t.lead.id === user?.id && t.status === "FORMING");

  function scrollToJoin() {
    joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
                Post the roles you need for a hackathon, or join a team that is recruiting.
              </p>
            </div>
          </div>

          {isStudent && (
            <div className="teams-hub-actions">
              <Link className="btn btn-primary" href="/teams/new">Create your team</Link>
              <button className="btn btn-ghost" type="button" onClick={scrollToJoin}>
                Join a team
              </button>
            </div>
          )}

          {error && <p className="form-err" role="alert">{error}</p>}

          {isStudent && yours.length === 0 && <TeamsHowItWorks />}

          {isStudent && leadTeams.length > 0 && (
            <TeamLeadInbox leadTeams={leadTeams} onDecided={() => void loadYours()} />
          )}

          {isStudent && (
            <section className="teams-section" aria-labelledby="your-teams-heading">
              <div className="teams-section-head">
                <h2 id="your-teams-heading">Your teams</h2>
                <p className="sub">Teams you lead, belong to, or have asked to join.</p>
              </div>

              {yours.length === 0 ? (
                <div className="app-empty">
                  <h3>No teams yet</h3>
                  <p>Create your team to post open roles, or browse recruiting teams below.</p>
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
                        <div className="team-recruit-roles">
                          {t.roles.map((r) => (
                            <span
                              key={r.id}
                              className={`team-role-open${r.slotsFilled >= r.slotCount ? " is-full" : ""}`}
                            >
                              {r.label}
                              <span className="team-role-open-count">
                                {r.slotsFilled}/{r.slotCount}
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <Link className="btn btn-ghost btn-sm" href={`/teams/${t.id}`}>Open team</Link>
                          {isLead && t.status === "FORMING" && (
                            <>
                              <Link className="btn btn-ghost btn-sm" href={`/teams/${t.id}/requests`}>
                                All requests
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

          <section
            ref={joinRef}
            id="join-teams"
            className="teams-section"
            aria-labelledby="discover-teams-heading"
          >
            <div className="teams-section-head">
              <h2 id="discover-teams-heading">
                {isStudent ? "Join a team" : "Hackathon teams"}
              </h2>
              <p className="sub">
                {isStudent
                  ? "Teams recruiting for hackathons — frontend, backend, DevOps, security, and more."
                  : "Browse student-led hackathon teams (view only)."}
              </p>
            </div>

            <div className="panel">
              <HackathonFilter
                value={hackathon}
                onChange={setHackathon}
                onSearch={() => void loadDiscover(hackathon)}
              />
            </div>

            {discover.length === 0 ? (
              <div className="app-empty">
                <h3>No teams recruiting right now</h3>
                <p>Try another hackathon name, or create your team to post the roles you need.</p>
              </div>
            ) : (
              <div className="team-recruit-grid">
                {discover.map((t) => (
                  <TeamRecruitCard
                    key={t.id}
                    team={t}
                    alreadyInvolved={yours.some((y) => y.id === t.id)}
                  />
                ))}
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
