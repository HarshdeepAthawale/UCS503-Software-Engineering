"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { newRole, TeamForm } from "@/components/team-form";
import { apiCreateTeam, ApiError, bootstrapSession, getUser } from "@/lib/client/api";
import { teamPayload, type TeamFormValues } from "@/lib/client/team";

const EMPTY: TeamFormValues = { name: "", hackathon: "", description: "", eventDate: "", roles: [newRole("", "first")] };

export default function NewTeamPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setAllowed(ok && getUser()?.role === "STUDENT");
      setReady(true);
    })();
  }, []);

  async function create(values: TeamFormValues) {
    setError(null);
    setBusy(true);
    try {
      const p = teamPayload(values);
      const created = await apiCreateTeam({
        name: p.name,
        hackathon: p.hackathon,
        description: p.description ?? undefined,
        eventDate: p.eventDate ?? undefined,
        roles: p.roles.map(({ label, slotCount, skillIds }) => ({ label, slotCount, skillIds })),
      });
      router.push(`/teams/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this team.");
    } finally {
      setBusy(false);
    }
  }

  if (ready && !allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page">
          <div className="wrap page-stack">
            <div className="empty-card">
              <h3>Only students can start a team</h3>
              <p>Faculty and alumni can browse teams, but team formation is student-led.</p>
              <Link className="btn btn-ghost" href="/teams">Back to teams</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <div className="page-title-row">
            <div>
              <Link className="back-link" href="/teams">← Teams</Link>
              <h1>Start a team</h1>
              <p className="sub">List the spots you need. Students request a spot, and you accept.</p>
            </div>
          </div>
          {error && <p className="form-err" role="alert">{error}</p>}
          {ready && (
            <TeamForm initial={EMPTY} submitLabel="Create team" busyLabel="Creating…" cancelHref="/teams" busy={busy}
              onSubmit={(v) => void create(v)} />
          )}
        </div>
      </main>
    </div>
  );
}
