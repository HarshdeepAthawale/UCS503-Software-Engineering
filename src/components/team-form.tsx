"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGetSkills, apiTeamSuggestions, type TaxonomySkill, type TeamSuggestions } from "@/lib/client/api";
import type { DraftRole, TeamFormValues } from "@/lib/client/team";
import { cleanTaxonomySkills } from "@/lib/domain/skill-taxonomy";

/** How many skill matches to show while searching - the taxonomy can be large. */
const SKILL_MATCHES = 8;

// Keys for roles added in the browser can be random; the FIRST role renders on
// the server too, so its key (used in element ids) must be fixed or the server
// and client HTML disagree (a hydration mismatch).
export const newRole = (label = "", key: string = crypto.randomUUID()): DraftRole => ({ key, label, slotCount: 1, skillIds: [] });

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

/**
 * The team form, shared by "Start a team" and "Edit team" so the two never
 * drift. Existing roles keep their id; a role with members cannot go below
 * them or be removed (the server enforces the same).
 */
export function TeamForm({
  initial,
  submitLabel,
  busyLabel,
  cancelHref,
  busy,
  onSubmit,
}: {
  initial: TeamFormValues;
  submitLabel: string;
  busyLabel: string;
  cancelHref: string;
  busy: boolean;
  onSubmit: (values: TeamFormValues) => void;
}) {
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);
  const [suggestions, setSuggestions] = useState<TeamSuggestions>({ hackathons: [], roles: [] });
  const [name, setName] = useState(initial.name);
  const [hackathon, setHackathon] = useState(initial.hackathon);
  const [description, setDescription] = useState(initial.description);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  const [roles, setRoles] = useState<DraftRole[]>(initial.roles);

  useEffect(() => {
    // Both optional: the form works without suggestions or skills.
    void Promise.all([apiGetSkills().catch(() => []), apiTeamSuggestions().catch(() => null)]).then(([skills, hints]) => {
      setTaxonomy(cleanTaxonomySkills(skills));
      if (hints) setSuggestions(hints);
    });
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

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, hackathon, description, eventDate, roles });
  }

  return (
    <form className="page-stack" onSubmit={submit} noValidate>
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

        {roles.map((r, i) => {
          const filled = r.filled ?? 0;
          return (
            <div key={r.key} className="role-editor">
              <div className="role-editor-row">
                <div className="field">
                  <label htmlFor={`role-${r.key}`}>Role {i + 1}</label>
                  <input id={`role-${r.key}`} value={r.label} maxLength={80} required placeholder="e.g. Backend developer"
                    onChange={(e) => updateRole(r.key, { label: e.target.value })} />
                </div>
                <div className="field field-spots">
                  <label htmlFor={`spots-${r.key}`}>Spots</label>
                  <input id={`spots-${r.key}`} type="number" min={Math.max(1, filled)} max={20} value={r.slotCount}
                    onChange={(e) => updateRole(r.key, { slotCount: Math.max(Number(e.target.value) || 1, filled, 1) })} />
                </div>
                <button type="button" className="btn btn-text role-remove" disabled={roles.length === 1 || filled > 0}
                  title={filled > 0 ? "This role has members, so it cannot be removed." : undefined}
                  onClick={() => setRoles((prev) => prev.filter((x) => x.key !== r.key))}
                  aria-label={`Remove role ${i + 1}`}>
                  Remove
                </button>
              </div>
              {filled > 0 && (
                <p className="field-hint">{filled} member{filled === 1 ? "" : "s"} already in this role.</p>
              )}
              {taxonomy.length > 0 && (
                <RoleSkills taxonomy={taxonomy} selected={r.skillIds} onToggle={(id) => toggleSkill(r.key, id)} />
              )}
            </div>
          );
        })}

        <button type="button" className="btn btn-ghost" onClick={() => addRole()}>+ Add another role</button>
      </section>

      <div className="form-actions">
        <Link className="btn btn-ghost" href={cancelHref}>Cancel</Link>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
