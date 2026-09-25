"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiCreateTeam,
  apiGetSkills,
  apiTeamSuggestions,
  ApiError,
  bootstrapSession,
  getUser,
  type TaxonomySkill,
  type TeamRoleInput,
  type TeamSuggestions,
} from "@/lib/client/api";
import { cleanTaxonomySkills } from "@/lib/domain/skill-taxonomy";

interface DraftRole extends TeamRoleInput {
  key: string;
}

/** How many skill matches to show while searching - the taxonomy can be large. */
const SKILL_MATCHES = 8;

// Keys for roles added in the browser can be random; the FIRST role renders on
// the server too, so its key (used in element ids) must be fixed or the server
// and client HTML disagree (a hydration mismatch).
const newRole = (label = "", key = crypto.randomUUID()): DraftRole => ({ key, label, slotCount: 1, skillIds: [] });

/** Search the skill taxonomy for one role and toggle skills on it. */
function RoleSkills({
  taxonomy,
  selected,
  onToggle,
}: {
  taxonomy: TaxonomySkill[];
  selected: string[];
  onToggle: (skillId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(taxonomy.map((s) => [s.id, s])), [taxonomy]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return taxonomy
      .filter((s) => !selected.includes(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, SKILL_MATCHES);
  }, [query, taxonomy, selected]);

  return (
    <div className="role-skills">
      {selected.length > 0 && (
        <div className="chip-row">
          {selected.map((id) => (
            <span key={id} className="chip is-static">
              {byId.get(id)?.name ?? "Skill"}
              <button type="button" className="chip-x" aria-label={`Remove ${byId.get(id)?.name ?? "skill"}`} onClick={() => onToggle(id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add a skill, e.g. React"
        aria-label="Search skills for this role"
      />
      {matches.length > 0 && (
        <div className="chip-row">
          {matches.map((s) => (
            <button key={s.id} type="button" className="chip" onClick={() => { onToggle(s.id); setQuery(""); }}>
              + {s.name}
            </button>
          ))}
        </div>
      )}
      {query.trim() && matches.length === 0 && <p className="field-hint">No skill matches “{query.trim()}”.</p>}
    </div>
  );
}

export default function NewTeamPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);
  const [suggestions, setSuggestions] = useState<TeamSuggestions>({ hackathons: [], roles: [] });

  const [name, setName] = useState("");
  const [hackathon, setHackathon] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [roles, setRoles] = useState<DraftRole[]>([newRole("", "first")]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      const canLead = ok && getUser()?.role === "STUDENT";
      setAllowed(canLead);
      setReady(true);
      if (!canLead) return;
      // Both optional: the form works without suggestions or skills.
      const [skills, hints] = await Promise.all([
        apiGetSkills().catch(() => []),
        apiTeamSuggestions().catch(() => null),
      ]);
      setTaxonomy(cleanTaxonomySkills(skills));
      if (hints) setSuggestions(hints);
    })();
  }, []);

  const usedLabels = new Set(roles.map((r) => r.label.trim().toLowerCase()));
  const roleIdeas = suggestions.roles.filter((r) => !usedLabels.has(r.label.toLowerCase()));

  function addRole(label = "") {
    setRoles((prev) => {
      // Fill the first empty role before adding a new card.
      const blank = prev.findIndex((r) => !r.label.trim());
      if (label && blank >= 0) return prev.map((r, i) => (i === blank ? { ...r, label } : r));
      return [...prev, newRole(label)];
    });
  }
  function updateRole(key: string, patch: Partial<DraftRole>) {
    setRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function toggleSkill(key: string, skillId: string) {
    setRoles((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, skillIds: r.skillIds.includes(skillId) ? r.skillIds.filter((s) => s !== skillId) : [...r.skillIds, skillId] }
          : r,
      ),
    );
  }

  const totalSpots = roles.reduce((s, r) => s + (Number(r.slotCount) || 0), 0);

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
        roles: roles.map((r) => ({ label: r.label.trim(), slotCount: Number(r.slotCount) || 1, skillIds: r.skillIds })),
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
        <form className="wrap wrap-form page-stack" onSubmit={onSubmit} noValidate>
          <div className="page-title-row">
            <div>
              <Link className="back-link" href="/teams">← Teams</Link>
              <h1>Start a team</h1>
              <p className="sub">List the spots you need. Students request a spot, and you accept.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          <section className="card section-card">
            <header>
              <h2>About the team</h2>
            </header>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Team name</label>
                <input id="name" value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="hackathon">Hackathon</label>
                <input id="hackathon" list="hackathon-suggestions" value={hackathon} maxLength={160} required
                  onChange={(e) => setHackathon(e.target.value)} placeholder="The event's name" />
                <datalist id="hackathon-suggestions">
                  {suggestions.hackathons.map((h) => <option key={h.name} value={h.name} />)}
                </datalist>
              </div>
              <div className="field span-2">
                <label htmlFor="description">What you're building <span className="optional">optional</span></label>
                <textarea id="description" value={description} maxLength={2000} rows={3}
                  onChange={(e) => setDescription(e.target.value)} placeholder="The problem statement, your idea, what you expect from teammates." />
              </div>
              <div className="field">
                <label htmlFor="eventDate">Event date <span className="optional">optional</span></label>
                <input id="eventDate" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card section-card">
            <header>
              <h2>Roles <span className="count">{roles.length} role{roles.length === 1 ? "" : "s"} · {totalSpots} spot{totalSpots === 1 ? "" : "s"}</span></h2>
              <p>Each role is a spot students can request. Skills help them see whether they fit.</p>
            </header>

            {roleIdeas.length > 0 && (
              <div className="chip-row" role="group" aria-label="Roles other teams use">
                <span className="field-hint">Often needed:</span>
                {roleIdeas.map((r) => (
                  <button key={r.label} type="button" className="chip" onClick={() => addRole(r.label)}>
                    + {r.label}
                  </button>
                ))}
              </div>
            )}

            {roles.map((r, i) => (
              <div key={r.key} className="role-editor">
                <div className="role-editor-row">
                  <div className="field">
                    <label htmlFor={`role-${r.key}`}>Role {i + 1}</label>
                    <input id={`role-${r.key}`} value={r.label} maxLength={80} required placeholder="e.g. Backend developer"
                      onChange={(e) => updateRole(r.key, { label: e.target.value })} />
                  </div>
                  <div className="field field-spots">
                    <label htmlFor={`spots-${r.key}`}>Spots</label>
                    <input id={`spots-${r.key}`} type="number" min={1} max={20} value={r.slotCount}
                      onChange={(e) => updateRole(r.key, { slotCount: Number(e.target.value) || 1 })} />
                  </div>
                  <button type="button" className="btn btn-text role-remove" disabled={roles.length === 1}
                    onClick={() => setRoles((prev) => prev.filter((x) => x.key !== r.key))}
                    aria-label={`Remove role ${i + 1}`}>
                    Remove
                  </button>
                </div>
                {taxonomy.length > 0 && (
                  <RoleSkills taxonomy={taxonomy} selected={r.skillIds} onToggle={(id) => toggleSkill(r.key, id)} />
                )}
              </div>
            ))}

            <button type="button" className="btn btn-ghost" onClick={() => addRole()}>+ Add another role</button>
          </section>

          <div className="form-actions">
            <Link className="btn btn-ghost" href="/teams">Cancel</Link>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create team"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
