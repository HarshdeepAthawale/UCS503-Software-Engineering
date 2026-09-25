"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { SignInRequired } from "@/components/sign-in-required";
import { TeamForm } from "@/components/team-form";
import { apiGetTeam, apiUpdateTeam, ApiError, bootstrapSession, getUser, type Team } from "@/lib/client/api";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { teamPayload, teamToForm, type TeamFormValues } from "@/lib/client/team";

/** The lead edits everything about their team: details and roles. */
export default function EditTeamPage() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (ok) {
        try {
          setTeam(await apiGetTeam(id));
        } catch (err) {
          if (!handleLoadError(router, err)) setError(loadErrorMessage(err, "Could not load this team."));
        }
      }
      setReady(true);
    })();
  }, [id, router]);

  async function save(values: TeamFormValues) {
    setError(null);
    setBusy(true);
    try {
      await apiUpdateTeam(id, teamPayload(values));
      router.push(`/teams/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your changes.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  if (ready && !signedIn) return <SignInRequired message="Sign in to edit your team." />;

  const me = getUser();
  const isLead = !!team && team.lead.id === me?.id;

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <div className="page-title-row">
            <div>
              <Link className="back-link" href={`/teams/${id}`}>← {team?.name ?? "Team"}</Link>
              <h1>Edit team</h1>
              <p className="sub">Change the details, add or remove roles, and adjust spots.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready || (!team && !error) ? (
            <div className="skeleton skeleton-card" aria-busy="true" />
          ) : team && !isLead ? (
            <div className="empty-card">
              <h3>Only the team lead can edit this team</h3>
              <Link className="btn btn-ghost" href={`/teams/${id}`}>Back to the team</Link>
            </div>
          ) : team && team.status === "CLOSED" ? (
            <div className="empty-card">
              <h3>This team is closed</h3>
              <p>A closed team can no longer be edited.</p>
              <Link className="btn btn-ghost" href={`/teams/${id}`}>Back to the team</Link>
            </div>
          ) : team ? (
            <TeamForm initial={teamToForm(team)} submitLabel="Save changes" busyLabel="Saving…" cancelHref={`/teams/${id}`}
              busy={busy} onSubmit={(v) => void save(v)} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
