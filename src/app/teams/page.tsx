"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { HackathonFilter } from "@/components/hackathon-filter";
import { TeamLeadInbox } from "@/components/team-lead-inbox";
import { TeamCard } from "@/components/team-card";
import { TeamsHowItWorks } from "@/components/teams-how-it-works";
import {
  apiListTeams,
  apiTeamSuggestions,
  bootstrapSession,
  getUser,
  type Team,
  type TeamSuggestions,
} from "@/lib/client/api";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { SignInRequired } from "@/components/sign-in-required";

/**
 * Teams hub. Students see the teams they lead, belong to or asked to join,
 * then every team recruiting now (searchable by hackathon). Faculty and alumni
 * can browse but not join - team formation is student-led.
 */
export default function TeamsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [yours, setYours] = useState<Team[]>([]);
  const [recruiting, setRecruiting] = useState<Team[]>([]);
  const [suggestions, setSuggestions] = useState<TeamSuggestions>({ hackathons: [], roles: [] });
  const [hackathon, setHackathon] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      if (!handleLoadError(router, err)) setError(loadErrorMessage(err, fallback));
    },
    [router],
  );

  const loadYours = useCallback(async () => {
    try {
      setYours((await apiListTeams({ mine: true, limit: 100 })).teams);
    } catch (err) {
      fail(err, "Could not load your teams.");
    }
  }, [fail]);

  const loadRecruiting = useCallback(
    async (q: string, after?: string) => {
      setSearching(true);
      try {
        const res = await apiListTeams({ hackathon: q || undefined, cursor: after });
        setRecruiting((prev) => (after ? [...prev, ...res.teams] : res.teams));
        setCursor(res.nextCursor);
      } catch (err) {
        fail(err, "Could not load recruiting teams.");
      } finally {
        setSearching(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (!ok) {
        setReady(true);
        return;
      }
      await Promise.all([
        getUser()?.role === "STUDENT" ? loadYours() : Promise.resolve(),
        loadRecruiting(""),
        apiTeamSuggestions().then(setSuggestions).catch(() => {}),
      ]);
      setReady(true);
    })();
  }, [loadYours, loadRecruiting]);

  const user = getUser();

  if (ready && !signedIn) {
    return <SignInRequired message="Sign in to browse and join hackathon teams." />;
  }

  const isStudent = user?.role === "STUDENT";
  const leading = yours.filter((t) => t.lead.id === user?.id && t.status === "FORMING");

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="page-title-row">
            <div>
              <h1>Teams</h1>
              <p className="sub">
                {isStudent
                  ? "Find teammates for a hackathon, or post the roles your team needs."
                  : "Student-led hackathon teams. Team formation is open to students only."}
              </p>
            </div>
            {isStudent && (
              <Link className="btn btn-primary" href="/teams/new">Start a team</Link>
            )}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready ? (
            <div className="card-grid" aria-busy="true">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          ) : (
            <>
              {isStudent && yours.length === 0 && <TeamsHowItWorks />}

              {isStudent && leading.length > 0 && (
                <TeamLeadInbox leadTeams={leading} onDecided={() => void loadYours()} />
              )}

              {isStudent && yours.length > 0 && (
                <section aria-labelledby="your-teams">
                  <div className="block-head">
                    <h2 id="your-teams">Your teams</h2>
                    <span className="block-count">{yours.length}</span>
                  </div>
                  <div className="card-grid">
                    {yours.map((t) => <TeamCard key={t.id} team={t} viewerId={user?.id} />)}
                  </div>
                </section>
              )}

              <section aria-labelledby="recruiting">
                <div className="block-head">
                  <h2 id="recruiting">Recruiting now</h2>
                </div>
                <HackathonFilter
                  value={hackathon}
                  suggestions={suggestions.hackathons}
                  onChange={setHackathon}
                  onSearch={(q) => void loadRecruiting(q)}
                />
                {recruiting.length === 0 && !searching ? (
                  <div className="empty-card">
                    <h3>{hackathon ? `No teams recruiting for “${hackathon}”` : "No teams recruiting yet"}</h3>
                    <p>
                      {isStudent
                        ? "Start a team and list the roles you need - it will show up here for others."
                        : "Teams appear here as students start recruiting."}
                    </p>
                    {isStudent && <Link className="btn btn-primary" href="/teams/new">Start a team</Link>}
                  </div>
                ) : (
                  <div className="card-grid">
                    {recruiting.map((t) => <TeamCard key={t.id} team={t} viewerId={user?.id} />)}
                  </div>
                )}
                {cursor && (
                  <div className="load-more">
                    <button className="btn btn-ghost" type="button" disabled={searching}
                      onClick={() => void loadRecruiting(hackathon, cursor)}>
                      {searching ? "Loading…" : "Show more teams"}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
