"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiCreateTeam,
  apiGetSkills,
  ApiError,
  bootstrapSession,
  getUser,
  type TeamRoleInput,
  type TaxonomySkill,
} from "@/lib/client/api";
import { TEAM_ROLE_TEMPLATES } from "@/lib/domain/hackathon";
import { cleanTaxonomySkills } from "@/lib/domain/skill-taxonomy";

interface DraftRole extends TeamRoleInput {
  key: string;
}

export default function NewTeamPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);

  const [name, setName] = useState("");
  const [hackathon, setHackathon] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [roles, setRoles] = useState<DraftRole[]>([
    { key: crypto.randomUUID(), label: "", slotCount: 1, skillIds: [] },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      const canLead = ok && getUser()?.role === "STUDENT";
      setAllowed(canLead);
      setReady(true);
      if (canLead) {
        try {
          setTaxonomy(cleanTaxonomySkills(await apiGetSkills()));
        } catch {
          /* taxonomy optional */
        }
      }
    })();
  }, []);

  function addRoleFromTemplate(label: string, skillNames: readonly string[]) {
    const skillIds = taxonomy
      .filter((s) => skillNames.some((n) => s.name.toLowerCase() === n.toLowerCase()))
      .map((s) => s.id);
    setRoles((prev) => [
      ...prev,
      { key: crypto.randomUUID(), label, slotCount: 1, skillIds },
    ]);
  }

  function addRole() {
    setRoles((prev) => [...prev, { key: crypto.randomUUID(), label: "", slotCount: 1, skillIds: [] }]);
  }
  function removeRole(key: string) {
    setRoles((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function updateRole(key: string, patch: Partial<DraftRole>) {
    setRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function toggleRoleSkill(key: string, skillId: string) {
    setRoles((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              skillIds: r.skillIds.includes(skillId)
                ? r.skillIds.filter((s) => s !== skillId)
                : [...r.skillIds, skillId],
            }
          : r,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiCreateTeam({
        name: name.trim(),
        hackathon: hackathon.trim(),
        description: description.trim() || undefined,
        eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
        roles: roles.map((r) => ({
          label: r.label.trim(),
          slotCount: Number(r.slotCount) || 1,
          skillIds: r.skillIds,
        })),
      });
      router.push(`/teams/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this team.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page">
          <div className="wrap app-empty">
            <h3>Only students can start a team</h3>
            <p>Faculty and alumni can view teams, but team formation is student-led.</p>
            <Link className="btn btn-ghost" href="/teams">← Back to teams</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="page-head">
            <div>
              <h1>Start a team</h1>
              <p className="sub">Declare the roles you need - others request a slot, you accept.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          <form className="panel form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">Team name</label>
              <input id="name" value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} placeholder="e.g. Team Nightowls" />
            </div>
            <div className="field">
              <label htmlFor="hackathon">Hackathon</label>
              <input id="hackathon" value={hackathon} maxLength={160} required onChange={(e) => setHackathon(e.target.value)} placeholder="e.g. Smart India Hackathon 2026" />
            </div>
            <div className="field">
              <label htmlFor="description">Description (optional)</label>
              <textarea id="description" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} placeholder="What you're building, the problem statement, expectations…" style={{ minHeight: 100 }} />
            </div>
            <div className="field">
              <label htmlFor="eventDate">Event date (optional)</label>
              <input id="eventDate" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>

            <div className="field">
              <label>Roles you need</label>
              <p className="empty-note" style={{ marginBottom: 10 }}>
                Post the slots you are recruiting for — students will see these on the teams page.
              </p>
              <div className="role-template-row" role="group" aria-label="Quick-add roles">
                {TEAM_ROLE_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className="skill-chip"
                    onClick={() => addRoleFromTemplate(t.label, t.skills)}
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
              {roles.map((r) => (
                <div key={r.key} className="panel" style={{ padding: 12, marginBottom: 10 }}>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div className="field" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
                      <label>Role</label>
                      <input value={r.label} maxLength={80} required placeholder="e.g. Backend" onChange={(e) => updateRole(r.key, { label: e.target.value })} />
                    </div>
                    <div className="field" style={{ minWidth: 100, marginBottom: 0 }}>
                      <label>Slots</label>
                      <input type="number" min={1} max={20} value={r.slotCount} onChange={(e) => updateRole(r.key, { slotCount: Number(e.target.value) || 1 })} />
                    </div>
                    <button type="button" className="mini" onClick={() => removeRole(r.key)} disabled={roles.length === 1}>
                      Remove
                    </button>
                  </div>
                  {taxonomy.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p className="empty-note" style={{ marginBottom: 6 }}>Skills for this role (optional)</p>
                      <div className="skills-current">
                        {taxonomy.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`skill-chip${r.skillIds.includes(s.id) ? " is-on" : ""}`}
                            onClick={() => toggleRoleSkill(r.key, s.id)}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="mini solid" onClick={addRole}>+ Add another role</button>
            </div>

            <div className="save-bar">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create team"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
