"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { useCallback, useEffect, useState } from "react";
import { ResumeViewer } from "@/components/resume-viewer";
import {
  apiAddProject,
  apiGetMyProfile,
  apiGetSkills,
  apiLogout,
  apiRemoveProject,
  apiRemoveResume,
  apiReplaceSkills,
  apiUpdateProfile,
  apiUploadResume,
  ApiError,
  bootstrapSession,
  getUser,
  type Profile,
  type TaxonomySkill,
} from "@/lib/client/api";

const MAX_RESUME_MB = 4;

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

  const [projTitle, setProjTitle] = useState("");
  const [projRepo, setProjRepo] = useState("");
  const [projLive, setProjLive] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projBusy, setProjBusy] = useState(false);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeRefresh, setResumeRefresh] = useState(0);

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

  // Projects use per-item CRUD (there is no batch-replace endpoint), so add and
  // remove call the API immediately and reload — independent of the "Save
  // profile" button, which owns the about/skills form.
  async function addProject() {
    if (!projTitle.trim()) return;
    setError(null);
    setProjBusy(true);
    try {
      await apiAddProject({
        title: projTitle.trim(),
        repoUrl: projRepo.trim() || null,
        liveUrl: projLive.trim() || null,
        description: projDesc.trim() || null,
      });
      setProjTitle("");
      setProjRepo("");
      setProjLive("");
      setProjDesc("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the project.");
    } finally {
      setProjBusy(false);
    }
  }

  async function removeProject(id: string) {
    setError(null);
    setProjBusy(true);
    try {
      await apiRemoveProject(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the project.");
    } finally {
      setProjBusy(false);
    }
  }

  async function onResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;
    setError(null);
    // Client-side pre-checks for instant feedback; the server re-validates.
    if (file.type !== "application/pdf") {
      setError("Only PDF résumés are accepted.");
      return;
    }
    if (file.size > MAX_RESUME_MB * 1024 * 1024) {
      setError(`The résumé must be at most ${MAX_RESUME_MB} MB.`);
      return;
    }
    setResumeBusy(true);
    try {
      await apiUploadResume(file);
      await load();
      setResumeRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload the résumé.");
    } finally {
      setResumeBusy(false);
    }
  }

  async function removeResume() {
    setError(null);
    setResumeBusy(true);
    try {
      await apiRemoveResume();
      await load();
      setResumeRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the résumé.");
    } finally {
      setResumeBusy(false);
    }
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

          <div className="panel-grid">
            <div className="panel-card">
              <h2>Résumé</h2>
              <p className="empty-note" style={{ marginBottom: 12 }}>
                Upload a PDF (max {MAX_RESUME_MB} MB). Faculty and employers can
                preview it inline while reviewing your applications — no download
                needed.
              </p>

              <div className="resume-actions">
                <label className={`btn btn-primary${resumeBusy ? " is-disabled" : ""}`}>
                  {resumeBusy
                    ? "Working…"
                    : profile?.resume
                      ? "Replace résumé"
                      : "Upload résumé"}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    disabled={resumeBusy}
                    onChange={(e) => void onResumeChange(e)}
                  />
                </label>
                {profile?.resume && (
                  <button
                    type="button"
                    className="mini"
                    onClick={() => void removeResume()}
                    disabled={resumeBusy}
                  >
                    Remove
                  </button>
                )}
              </div>

              {profile?.resume ? (
                <div style={{ marginTop: 16 }}>
                  <ResumeViewer userId={profile.userId} refreshKey={resumeRefresh} />
                </div>
              ) : (
                <p className="empty-note" style={{ marginTop: 12 }}>
                  No résumé yet.
                </p>
              )}
            </div>
          </div>

          <div className="panel-grid">
            <div className="panel-card">
              <h2>Projects</h2>
              <p className="empty-note" style={{ marginBottom: 12 }}>
                Portfolio work with a repository link. Added and removed
                immediately — no need to press Save.
              </p>

              <div className="proj-list">
                {(profile?.projects.length ?? 0) === 0 && (
                  <p className="empty-note">
                    No projects yet. Add one with a repo link below.
                  </p>
                )}
                {profile?.projects.map((p) => (
                  <div key={p.id} className="proj-row">
                    <div className="proj-main">
                      <strong>{p.title}</strong>
                      {p.description && <p className="sub">{p.description}</p>}
                      <div className="proj-links">
                        {p.repoUrl && (
                          <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">
                            Repository
                          </a>
                        )}
                        {p.liveUrl && (
                          <a href={p.liveUrl} target="_blank" rel="noopener noreferrer">
                            Live
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      className="mini"
                      type="button"
                      onClick={() => void removeProject(p.id)}
                      disabled={projBusy}
                      aria-label={`Remove ${p.title}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="form" style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="projTitle">Title</label>
                  <input
                    id="projTitle"
                    type="text"
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    placeholder="e.g. Distributed cache in Rust"
                    maxLength={140}
                  />
                </div>
                <div className="field">
                  <label htmlFor="projRepo">Repository URL</label>
                  <input
                    id="projRepo"
                    type="url"
                    value={projRepo}
                    onChange={(e) => setProjRepo(e.target.value)}
                    placeholder="https://github.com/…"
                    maxLength={500}
                  />
                </div>
                <div className="field">
                  <label htmlFor="projLive">Live URL (optional)</label>
                  <input
                    id="projLive"
                    type="url"
                    value={projLive}
                    onChange={(e) => setProjLive(e.target.value)}
                    placeholder="https://…"
                    maxLength={500}
                  />
                </div>
                <div className="field">
                  <label htmlFor="projDesc">Description (optional)</label>
                  <textarea
                    id="projDesc"
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                    placeholder="What it does, your role, the stack…"
                    maxLength={2000}
                  />
                </div>
                <div className="save-bar">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void addProject()}
                    disabled={projBusy || !projTitle.trim()}
                  >
                    {projBusy ? "Working…" : "Add project"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
