"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { useCallback, useEffect, useState } from "react";
import {
  apiGetMyProfile,
  apiGetSkills,
  apiLogout,
  apiReplaceSkills,
  apiUpdateProfile,
  ApiError,
  bootstrapSession,
  getUser,
  type Profile,
  type TaxonomySkill,
} from "@/lib/client/api";

const PROFICIENCIES = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
] as const;

interface PendingSkill {
  skillId: string;
  proficiency: (typeof PROFICIENCIES)[number];
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notSignedIn, setNotSignedIn] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);
  const [skills, setSkills] = useState<PendingSkill[]>([]);

  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [cgpaPublic, setCgpaPublic] = useState(false);
  const [bio, setBio] = useState("");

  const [pickerSkill, setPickerSkill] = useState("");
  const [pickerProficiency, setPickerProficiency] =
    useState<(typeof PROFICIENCIES)[number]>("INTERMEDIATE");

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const ok = await bootstrapSession();
    if (!ok) {
      setNotSignedIn(true);
      setLoading(false);
      return;
    }
    try {
      const [p, tax] = await Promise.all([apiGetMyProfile(), apiGetSkills()]);
      setProfile(p);
      setTaxonomy(tax);
      if (p) {
        setBranch(p.branch ?? "");
        setYear(p.year != null ? String(p.year) : "");
        setCgpa(p.cgpa != null ? String(p.cgpa) : "");
        setCgpaPublic(p.cgpaPublic);
        setBio(p.bio ?? "");
        setSkills(
          p.skills.map((s) => ({
            skillId: s.id,
            proficiency: s.proficiency as PendingSkill["proficiency"],
          })),
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await apiUpdateProfile({
        branch: branch.trim() || null,
        year: year ? Number(year) : null,
        cgpa: cgpa ? Number(cgpa) : null,
        cgpaPublic,
        bio: bio.trim() || null,
      });
      await apiReplaceSkills(skills);
      setSaved(true);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save your profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  function addSkill() {
    if (!pickerSkill) return;
    setSkills((prev) => {
      const next = prev.filter((s) => s.skillId !== pickerSkill);
      return [
        ...next,
        { skillId: pickerSkill, proficiency: pickerProficiency },
      ];
    });
    setPickerSkill("");
    setPickerProficiency("INTERMEDIATE");
  }

  function removeSkill(skillId: string) {
    setSkills((prev) => prev.filter((s) => s.skillId !== skillId));
  }

  async function onLogout() {
    await apiLogout();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <p className="sub">Loading your profile…</p>
      </main>
    );
  }

  if (notSignedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <p className="sub">Create a profile to join the pilot.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
            <Link className="btn btn-ghost" href="/register">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();
  const selectedSkillIds = new Set(skills.map((s) => s.skillId));
  const available = taxonomy.filter((t) => !selectedSkillIds.has(t.id));
  const skillById = new Map(taxonomy.map((t) => [t.id, t]));

  return (
    // Wrapped in `.app-shell` with `AppNav`, exactly like every other signed-in
    // screen. This page was the only portal route that rendered no navigation
    // at all: it offered a single "Home" link, which sent a signed-in user out
    // to the marketing landing page and left them no way back into the app
    // except the browser's back button.
    <div className="app-shell">
      <AppNav user={user} />
      <main className="profile-shell">
        <div className="wrap">
          <div className="profile-head">
            <div>
              <span className="role">{user?.role ?? ""}</span>
              <h1>{user?.name ?? "My profile"}</h1>
              {/* The raw account UUID used to be printed here beside the
                  status. It is an internal identifier: it tells the account
                  holder nothing they can act on, and it is the kind of value
                  that ends up in screenshots and support threads. Only the
                  status is shown now - the id remains available to code via
                  `user.id`, it is simply never rendered. */}
              <div className="mono-id">{user?.status ?? ""}</div>
            </div>
          </div>

          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}
          {saved && <p className="form-ok">Profile saved.</p>}

          <form className="panel-grid" onSubmit={onSave} noValidate>
            <div className="panel-card">
              <h2>About you</h2>
              <div className="form">
                <div className="field">
                  <label htmlFor="branch">Branch</label>
                  <input
                    id="branch"
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Computer Science"
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label htmlFor="year">Year</label>
                  <input
                    id="year"
                    type="number"
                    min={1}
                    max={6}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="1-6"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cgpa">CGPA (private by default)</label>
                  <input
                    id="cgpa"
                    type="number"
                    step="0.01"
                    min={0}
                    max={10}
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    placeholder="0.00 - 10.00"
                  />
                </div>
                <div className="check-row">
                  <input
                    id="cgpaPublic"
                    type="checkbox"
                    checked={cgpaPublic}
                    onChange={(e) => setCgpaPublic(e.target.checked)}
                  />
                  <label htmlFor="cgpaPublic">
                    Make my CGPA visible to posters
                  </label>
                </div>
                <div className="field">
                  <label htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Research interests, projects, what you're looking for…"
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>

            <div className="panel-card">
              <h2>Skills</h2>
              <p className="empty-note" style={{ marginBottom: 12 }}>
                Drawn from the institute taxonomy - self-claimed until an
                attestation verifies them.
              </p>

              <div className="skills-current">
                {skills.length === 0 && (
                  <p className="empty-note">
                    No skills yet. Add from the taxonomy.
                  </p>
                )}
                {skills.map((s) => {
                  const meta = skillById.get(s.skillId);
                  return (
                    <span
                      key={s.skillId}
                      className="skill-chip"
                      title={meta?.domain ?? ""}
                    >
                      {meta?.name ?? s.skillId.slice(0, 8)} ·{" "}
                      {s.proficiency.toLowerCase()}
                      <span
                        className="x"
                        role="button"
                        aria-label={`Remove ${meta?.name ?? "skill"}`}
                        tabIndex={0}
                        onClick={() => removeSkill(s.skillId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            removeSkill(s.skillId);
                        }}
                      >
                        ×
                      </span>
                    </span>
                  );
                })}
              </div>

              <div className="skill-picker">
                <div className="skill-add-row">
                  <select
                    aria-label="Pick a skill"
                    value={pickerSkill}
                    onChange={(e) => setPickerSkill(e.target.value)}
                  >
                    <option value="">Choose a skill…</option>
                    {available.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.domain}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Proficiency"
                    value={pickerProficiency}
                    onChange={(e) =>
                      setPickerProficiency(
                        e.target.value as typeof pickerProficiency,
                      )
                    }
                  >
                    {PROFICIENCIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    className="mini solid"
                    type="button"
                    onClick={addSkill}
                    disabled={!pickerSkill}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="save-bar">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
