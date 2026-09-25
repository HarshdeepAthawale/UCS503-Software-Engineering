"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ResumeViewer } from "@/components/resume-viewer";
import {
  apiAddProject,
  apiUpdateProject,
  apiGetMyProfile,
  apiGetSkills,
  apiRemoveProject,
  apiRemoveResume,
  apiReplaceSkills,
  apiUpdateProfile,
  apiUploadResume,
  apiGetCalendarStatus,
  apiDisconnectCalendar,
  apiGetNotificationFrequency,
  apiSetNotificationFrequency,
  googleCalendarConnectUrl,
  ApiError,
  bootstrapSession,
  getUser,
  type NotificationFrequency,
  type OppType,
  type Profile,
  type Project,
  type TaxonomySkill,
} from "@/lib/client/api";
import { BranchSelect } from "@/components/branch-select";
import { ProfileSkillAddRow, type Proficiency } from "@/components/profile-skill-add-row";
import { handleLoadError } from "@/lib/client/handle-load-error";
import { initials, roleLabel } from "@/lib/client/nav";
import { profileChecklist, type ProfileSection } from "@/lib/client/profile-checklist";
import { normalizeLink } from "@/lib/client/links";

/** Field names the server reports on a failed save, as the user knows them. */
const FIELD_LABEL: Record<string, string> = {
  headline: "Headline",
  bio: "Bio",
  branch: "Branch",
  year: "Year",
  cgpa: "CGPA",
  backlogs: "Active backlogs",
  githubUrl: "GitHub",
  linkedinUrl: "LinkedIn",
  websiteUrl: "Website",
  hoursPerWeek: "Hours a week",
};

const MAX_RESUME_MB = 4;
const SKILL_LIMIT = 8; // mirrors PROFILE_SKILL_LIMIT in the server schema

/** Posting types a member can declare themselves open to (mirrors OppType). */
const OPEN_TO_OPTIONS: { value: OppType; label: string }[] = [
  { value: "RESEARCH", label: "Research" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TA", label: "TA" },
  { value: "HACKATHON_TEAM", label: "Hackathon team" },
  { value: "MICRO_TASK", label: "Micro-task" },
  { value: "REFERRAL", label: "Referral" },
];

/** How often notifications are emailed; saved as soon as one is picked. */
const EMAIL_OPTIONS: { value: NotificationFrequency; label: string; hint: string }[] = [
  { value: "IMMEDIATE", label: "Every update", hint: "An email for each new notification" },
  { value: "DAILY", label: "Daily summary", hint: "One email a day at most" },
  { value: "WEEKLY", label: "Weekly summary", hint: "One email a week at most" },
];

interface PendingSkill {
  name: string;
  proficiency: Proficiency;
}

/** Everything the Save button owns. Résumé, projects and calendar save on their own. */
interface FormState {
  headline: string;
  bio: string;
  branch: string;
  year: string;
  cgpa: string;
  cgpaPublic: boolean;
  backlogs: string;
  githubUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  openTo: OppType[];
  hoursPerWeek: string;
  skills: PendingSkill[];
}

const EMPTY_FORM: FormState = {
  headline: "",
  bio: "",
  branch: "",
  year: "",
  cgpa: "",
  cgpaPublic: false,
  backlogs: "",
  githubUrl: "",
  linkedinUrl: "",
  websiteUrl: "",
  openTo: [],
  hoursPerWeek: "",
  skills: [],
};

const num = (v: number | null | undefined) => (v == null ? "" : String(v));

function formFrom(p: Profile | null): FormState {
  if (!p) return EMPTY_FORM;
  return {
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    branch: p.branch ?? "",
    year: num(p.year),
    cgpa: num(p.cgpa),
    cgpaPublic: p.cgpaPublic,
    backlogs: num(p.backlogs),
    githubUrl: p.githubUrl ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    websiteUrl: p.websiteUrl ?? "",
    openTo: p.openTo ?? [],
    hoursPerWeek: num(p.hoursPerWeek),
    skills: p.skills.map((s) => ({ name: s.name, proficiency: s.proficiency as Proficiency })),
  };
}

const EMPTY_PROJECT = { title: "", repoUrl: "", liveUrl: "", description: "" };

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notSignedIn, setNotSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);

  // `form` is what the user is editing; `saved` is the last server copy. The
  // save bar appears only while they differ.
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  // A failed save names the field; it is shown in the save bar (where the
  // user is looking), and that field is marked invalid until they edit it.
  const [saveError, setSaveError] = useState<{ message: string; field: string | null } | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (saveError?.field === key) setSaveError(null);
  };
  const invalid = (field: string) => saveError?.field === field || undefined;

  const [pickerName, setPickerName] = useState("");
  const [pickerProficiency, setPickerProficiency] = useState<Proficiency>("INTERMEDIATE");

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [projBusy, setProjBusy] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeRefresh, setResumeRefresh] = useState(0);

  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarInfo, setCalendarInfo] = useState<string | null>(null);
  const [emailFrequency, setEmailFrequency] = useState<NotificationFrequency | null>(null);

  /**
   * Load (or reload) the profile. Only the FIRST load shows the loading state:
   * reloading after a save or a project change used to blank the whole page to
   * "Loading your profile…" and back, which read as the page being slow.
   */
  const load = useCallback(async () => {
    const ok = await bootstrapSession();
    if (!ok) {
      setNotSignedIn(true);
      setLoading(false);
      return;
    }
    try {
      // In parallel, and only AFTER the session is restored: the calendar
      // status used to be requested on mount, before there was an access
      // token, so a fresh load of /profile always got a 401. It is optional,
      // so its failure must not fail the page.
      const [p, tax, calendar, frequency] = await Promise.all([
        apiGetMyProfile(),
        apiGetSkills(),
        apiGetCalendarStatus().catch(() => null),
        apiGetNotificationFrequency().catch(() => null),
      ]);
      setEmailFrequency(frequency);
      setProfile(p);
      setTaxonomy(tax);
      const next = formFrom(p);
      setForm(next);
      setSaved(next);
      if (calendar) {
        setCalendarEnabled(calendar.enabled);
        setCalendarConnected(calendar.connected);
      }
    } catch (err) {
      // A 401 here means the refresh cookie minted a token the API then
      // rejected - an expired or revoked session, not a load failure.
      if (err instanceof ApiError && err.status === 401) {
        setNotSignedIn(true);
      } else if (!handleLoadError(router, err)) {
        setError(err instanceof ApiError ? err.message : "Failed to load your profile.");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // The Google Calendar connect flow comes back here with a status flag.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("calendarConnected")) {
      setCalendarInfo("Google Calendar connected.");
      setCalendarConnected(true);
    } else if (params.has("calendarError")) {
      setError(params.get("calendarError"));
    } else {
      return;
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // MUST stay above the early returns below (hooks run in call order).
  const suggestions = useMemo(() => {
    const selected = new Set(form.skills.map((s) => s.name.toLowerCase()));
    return taxonomy.filter((t) => !selected.has(t.name.toLowerCase()));
  }, [form.skills, taxonomy]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function onSave() {
    setError(null);
    setSaveError(null);
    setBusy(true);
    try {
      await apiUpdateProfile({
        branch: form.branch.trim() || null,
        year: form.year ? Number(form.year) : null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        cgpaPublic: form.cgpaPublic,
        backlogs: form.backlogs ? Number(form.backlogs) : null,
        bio: form.bio.trim() || null,
        headline: form.headline.trim() || null,
        githubUrl: normalizeLink(form.githubUrl),
        linkedinUrl: normalizeLink(form.linkedinUrl),
        websiteUrl: normalizeLink(form.websiteUrl),
        openTo: form.openTo,
        hoursPerWeek: form.hoursPerWeek ? Number(form.hoursPerWeek) : null,
      });
      await apiReplaceSkills(form.skills);
      await load();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? { message: err.message, field: err.field }
          : { message: "Could not save your profile.", field: null },
      );
    } finally {
      setBusy(false);
    }
  }

  function addSkill() {
    const name = pickerName.trim();
    if (!name || form.skills.length >= SKILL_LIMIT) return;
    // Replace a same-named entry (case-insensitive) rather than duplicating it.
    const rest = form.skills.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
    set("skills", [...rest, { name, proficiency: pickerProficiency }]);
    setPickerName("");
    setPickerProficiency("INTERMEDIATE");
  }

  function toggleOpenTo(value: OppType) {
    set("openTo", form.openTo.includes(value) ? form.openTo.filter((v) => v !== value) : [...form.openTo, value]);
  }

  // Projects use per-item endpoints, so they save immediately.
  function closeProjectForm() {
    setProjectFormOpen(false);
    setEditingProjectId(null);
    setProject(EMPTY_PROJECT);
  }

  function editProject(p: Project) {
    setEditingProjectId(p.id);
    setProject({
      title: p.title,
      repoUrl: p.repoUrl ?? "",
      liveUrl: p.liveUrl ?? "",
      description: p.description ?? "",
    });
    setProjectFormOpen(true);
  }

  async function saveProject() {
    if (!project.title.trim()) return;
    setProjError(null);
    setProjBusy(true);
    try {
      const input = {
        title: project.title.trim(),
        repoUrl: normalizeLink(project.repoUrl),
        liveUrl: normalizeLink(project.liveUrl),
        description: project.description.trim() || null,
      };
      if (editingProjectId) await apiUpdateProject(editingProjectId, input);
      else await apiAddProject(input);
      closeProjectForm();
      await load();
    } catch (err) {
      setProjError(err instanceof ApiError ? err.message : "Could not save the project.");
    } finally {
      setProjBusy(false);
    }
  }

  async function removeProject(id: string) {
    setError(null);
    setProjBusy(true);
    try {
      await apiRemoveProject(id);
      if (editingProjectId === id) closeProjectForm();
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

  async function disconnectCalendar() {
    setCalendarBusy(true);
    setError(null);
    try {
      await apiDisconnectCalendar();
      setCalendarConnected(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect Google Calendar.");
    } finally {
      setCalendarBusy(false);
    }
  }

  async function changeEmailFrequency(next: NotificationFrequency) {
    const previous = emailFrequency;
    setEmailFrequency(next);
    setError(null);
    try {
      setEmailFrequency(await apiSetNotificationFrequency(next));
    } catch (err) {
      setEmailFrequency(previous);
      setError(err instanceof ApiError ? err.message : "Could not save your email preference.");
    }
  }

  function jumpTo(section: ProfileSection) {
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (notSignedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <p className="sub">Sign in to edit your profile.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();

  if (loading || !user) {
    return (
      <div className="app-shell">
        <AppNav user={user} />
        <main id="content" className="app-page">
          <div className="wrap profile-layout" aria-busy="true">
            <div className="skeleton skeleton-card" />
            <div className="profile-sections">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const student = user.role === "STUDENT";
  const atSkillLimit = form.skills.length >= SKILL_LIMIT;
  const checklist = profileChecklist(user.role, {
    headline: saved.headline,
    bio: saved.bio,
    branch: saved.branch,
    year: saved.year,
    cgpa: saved.cgpa,
    skillCount: saved.skills.length,
    openToCount: saved.openTo.length,
    hasResume: !!profile?.resume,
    hasLink: !!(saved.githubUrl || saved.linkedinUrl || saved.websiteUrl),
    projectCount: profile?.projects.length ?? 0,
  });
  const facts = [roleLabel(user.role), saved.branch, saved.year && `Year ${saved.year}`].filter(Boolean);

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap profile-layout">
          {/* ── Summary ─────────────────────────────────────────────── */}
          <aside className="profile-summary card">
            <div className="profile-id">
              <span className="avatar avatar-xl" aria-hidden="true">{initials(user.name)}</span>
              <div>
                <h1>{user.name}</h1>
                <p className="profile-facts">{facts.join(" · ")}</p>
              </div>
            </div>
            {saved.headline && <p className="profile-headline">{saved.headline}</p>}

            <div className="completeness">
              <div className="completeness-head">
                <span>Profile strength</span>
                <strong>{checklist.percent}%</strong>
              </div>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={checklist.percent}>
                <span style={{ width: `${checklist.percent}%` }} />
              </div>
              <ul className="checklist">
                {checklist.items.map((item) => (
                  <li key={item.key} className={item.done ? "done" : ""}>
                    <button type="button" onClick={() => jumpTo(item.section)} disabled={item.done}>
                      <span className="check" aria-hidden="true">{item.done ? "✓" : ""}</span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <Link className="btn btn-ghost btn-block" href={`/profile/${user.id}`}>
              View as others see it
            </Link>
          </aside>

          {/* ── Sections ────────────────────────────────────────────── */}
          <div className="profile-sections">
            {error && <p className="form-err" role="alert">{error}</p>}

            <section id="section-basics" className="card section-card">
              <header>
                <h2>Basics</h2>
                <p>The first thing {student ? "a poster" : "a student"} reads about you.</p>
              </header>
              <div className="form">
                <div className="field">
                  <label htmlFor="headline">Headline</label>
                  <input id="headline" aria-invalid={invalid("headline")} value={form.headline} maxLength={120}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder={student ? "e.g. 3rd-year COE · ML and computer vision" : "e.g. Associate Professor · distributed systems"} />
                </div>
                <div className="field">
                  <label htmlFor="bio">Bio</label>
                  <textarea id="bio" aria-invalid={invalid("bio")} value={form.bio} maxLength={1000} rows={4}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder={student ? "Your interests, what you've built, and what you're looking for." : "Your research areas and the kind of students you work with."} />
                  <span className="field-hint">{form.bio.length}/1000</span>
                </div>
              </div>
            </section>

            {student && (
              <section id="section-academics" className="card section-card">
                <header>
                  <h2>Academics</h2>
                  <p>Postings can require a branch, a minimum CGPA or a backlog limit. These decide which ones you can apply to.</p>
                </header>
                <div className="form-grid">
                  <div className="field span-2">
                    <label htmlFor="branch">Branch</label>
                    <BranchSelect id="branch" value={form.branch} onChange={(v) => set("branch", v)} />
                  </div>
                  <div className="field">
                    <label htmlFor="year">Year</label>
                    <input id="year" aria-invalid={invalid("year")} type="number" min={1} max={6} value={form.year}
                      onChange={(e) => set("year", e.target.value)} placeholder="1–6" />
                  </div>
                  <div className="field">
                    <label htmlFor="cgpa">CGPA</label>
                    <input id="cgpa" aria-invalid={invalid("cgpa")} type="number" step="0.01" min={0} max={10} value={form.cgpa}
                      onChange={(e) => set("cgpa", e.target.value)} placeholder="0.00–10.00" />
                  </div>
                  <div className="field">
                    <label htmlFor="backlogs">Active backlogs</label>
                    <input id="backlogs" aria-invalid={invalid("backlogs")} type="number" min={0} max={50} value={form.backlogs}
                      onChange={(e) => set("backlogs", e.target.value)} placeholder="0" />
                  </div>
                </div>
                <label className="toggle-row" htmlFor="cgpaPublic">
                  <input id="cgpaPublic" type="checkbox" checked={form.cgpaPublic}
                    onChange={(e) => set("cgpaPublic", e.target.checked)} />
                  <span>
                    <strong>Show my CGPA on my profile</strong>
                    <span className="field-hint">Posters you apply to always see it. This only affects your public profile.</span>
                  </span>
                </label>
              </section>
            )}

            {student && (
              <section id="section-availability" className="card section-card">
                <header>
                  <h2>Availability</h2>
                  <p>What you&apos;re open to right now.</p>
                </header>
                <div className="chip-row" role="group" aria-label="Open to">
                  {OPEN_TO_OPTIONS.map((o) => {
                    const on = form.openTo.includes(o.value);
                    return (
                      <button key={o.value} type="button" className={`chip${on ? " is-on" : ""}`}
                        aria-pressed={on} onClick={() => toggleOpenTo(o.value)}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div className="field field-narrow">
                  <label htmlFor="hoursPerWeek">Hours a week</label>
                  <input id="hoursPerWeek" aria-invalid={invalid("hoursPerWeek")} type="number" min={1} max={80} value={form.hoursPerWeek}
                    onChange={(e) => set("hoursPerWeek", e.target.value)} placeholder="e.g. 10" />
                </div>
              </section>
            )}

            <section id="section-skills" className="card section-card">
              <header>
                <h2>Skills <span className="count">{form.skills.length}/{SKILL_LIMIT}</span></h2>
                <p>Self-claimed until someone you worked with verifies them.</p>
              </header>
              <div className="chip-row">
                {form.skills.length === 0 && <p className="empty-note">No skills yet. Add your first below.</p>}
                {form.skills.map((s) => (
                  <span key={s.name} className="chip is-static">
                    {s.name}
                    <span className="chip-meta">{s.proficiency.toLowerCase()}</span>
                    <button type="button" className="chip-x" aria-label={`Remove ${s.name}`}
                      onClick={() => set("skills", form.skills.filter((x) => x.name !== s.name))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <ProfileSkillAddRow
                name={pickerName}
                proficiency={pickerProficiency}
                suggestions={suggestions}
                atLimit={atSkillLimit}
                limit={SKILL_LIMIT}
                onNameChange={setPickerName}
                onProficiencyChange={setPickerProficiency}
                onAdd={addSkill}
              />
            </section>

            <section id="section-links" className="card section-card">
              <header>
                <h2>Links</h2>
                <p>Where people can see your work.</p>
              </header>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="githubUrl">GitHub</label>
                  <input id="githubUrl" aria-invalid={invalid("githubUrl")} type="url" value={form.githubUrl} maxLength={500}
                    onChange={(e) => set("githubUrl", e.target.value)} placeholder="https://github.com/…" />
                </div>
                <div className="field">
                  <label htmlFor="linkedinUrl">LinkedIn</label>
                  <input id="linkedinUrl" aria-invalid={invalid("linkedinUrl")} type="url" value={form.linkedinUrl} maxLength={500}
                    onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/…" />
                </div>
                <div className="field span-2">
                  <label htmlFor="websiteUrl">Website</label>
                  <input id="websiteUrl" aria-invalid={invalid("websiteUrl")} type="url" value={form.websiteUrl} maxLength={500}
                    onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </section>

            {student && (
              <section id="section-resume" className="card section-card">
                <header>
                  <h2>Résumé</h2>
                  <p>PDF, up to {MAX_RESUME_MB} MB. Posters preview it while reviewing your applications. Saves as soon as you upload.</p>
                </header>
                <div className="row-actions">
                  <label className={`btn ${profile?.resume ? "btn-ghost" : "btn-primary"}${resumeBusy ? " is-disabled" : ""}`}>
                    {resumeBusy ? "Uploading…" : profile?.resume ? "Replace PDF" : "Upload PDF"}
                    <input type="file" accept="application/pdf" hidden disabled={resumeBusy}
                      onChange={(e) => void onResumeChange(e)} />
                  </label>
                  {profile?.resume && (
                    <button type="button" className="btn btn-text" onClick={() => void removeResume()} disabled={resumeBusy}>
                      Remove
                    </button>
                  )}
                </div>
                {profile?.resume && <ResumeViewer userId={profile.userId} refreshKey={resumeRefresh} />}
              </section>
            )}

            <section id="section-projects" className="card section-card">
              <header>
                <h2>Projects</h2>
                <p>Work you&apos;ve built, with a repository or live link. Saves immediately.</p>
              </header>
              {(profile?.projects.length ?? 0) > 0 && (
                <ul className="project-list">
                  {profile?.projects.map((p) => (
                    <li key={p.id} className="project-item">
                      <div>
                        <strong>{p.title}</strong>
                        {p.description && <p>{p.description}</p>}
                        <div className="project-links">
                          {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">Repository ↗</a>}
                          {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noopener noreferrer">Live ↗</a>}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button className="btn btn-text" type="button" onClick={() => editProject(p)} disabled={projBusy}>Edit</button>
                        <button className="btn btn-text" type="button" onClick={() => void removeProject(p.id)} disabled={projBusy}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {projectFormOpen ? (
                <div className="form inset-form">
                  {projError && <p className="form-err" role="alert">{projError}</p>}
                  <div className="field">
                    <label htmlFor="projTitle">Title</label>
                    <input id="projTitle" value={project.title} maxLength={140} autoFocus
                      onChange={(e) => setProject({ ...project, title: e.target.value })} placeholder="e.g. Distributed cache in Rust" />
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="projRepo">Repository URL</label>
                      <input id="projRepo" type="url" value={project.repoUrl} maxLength={500}
                        onChange={(e) => setProject({ ...project, repoUrl: e.target.value })} placeholder="https://github.com/…" />
                    </div>
                    <div className="field">
                      <label htmlFor="projLive">Live URL</label>
                      <input id="projLive" type="url" value={project.liveUrl} maxLength={500}
                        onChange={(e) => setProject({ ...project, liveUrl: e.target.value })} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="projDesc">Description</label>
                    <textarea id="projDesc" value={project.description} maxLength={2000} rows={3}
                      onChange={(e) => setProject({ ...project, description: e.target.value })}
                      placeholder="What it does, your role, the stack (optional)" />
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-primary" type="button" onClick={() => void saveProject()}
                      disabled={projBusy || !project.title.trim()}>
                      {projBusy ? "Saving…" : editingProjectId ? "Save project" : "Add project"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeProjectForm} disabled={projBusy}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost" type="button" onClick={() => setProjectFormOpen(true)}>
                  + Add a project
                </button>
              )}
            </section>

            {emailFrequency && (
              <section className="card section-card">
                <header>
                  <h2>Email notifications</h2>
                  <p>How often we email you about your {student ? "applications" : "postings"}. Saves as soon as you choose.</p>
                </header>
                <div className="choice-grid" role="radiogroup" aria-label="Email frequency">
                  {EMAIL_OPTIONS.map((o) => (
                    <label key={o.value} className={`choice${emailFrequency === o.value ? " is-on" : ""}`}>
                      <input type="radio" name="emailFrequency" value={o.value}
                        checked={emailFrequency === o.value}
                        onChange={() => void changeEmailFrequency(o.value)} />
                      <strong>{o.label}</strong>
                      <span>{o.hint}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {calendarEnabled && (
              <section className="card section-card">
                <header>
                  <h2>Google Calendar</h2>
                  <p>Schedule Meet interviews and team syncs with an automatic invite and video link.</p>
                </header>
                {calendarInfo && <p className="form-ok">{calendarInfo}</p>}
                {calendarConnected ? (
                  <div className="row-actions">
                    <span className="status-pill is-ok">Connected</span>
                    <button className="btn btn-text" type="button" disabled={calendarBusy} onClick={() => void disconnectCalendar()}>
                      {calendarBusy ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>
                ) : (
                  <a className="btn btn-ghost" href={googleCalendarConnectUrl("/profile")}>Connect Google Calendar</a>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      {(dirty || justSaved) && (
        <div className="save-dock" role="status">
          <div className="save-dock-inner">
            {saveError ? (
              <span className="save-dock-error" role="alert">
                {saveError.field && FIELD_LABEL[saveError.field] ? (
                  <button type="button" className="linklike" onClick={() => document.getElementById(saveError.field!)?.focus()}>
                    {FIELD_LABEL[saveError.field]}
                  </button>
                ) : null}
                {saveError.field && FIELD_LABEL[saveError.field] ? ": " : ""}
                {saveError.message}
              </span>
            ) : (
              <span>{dirty ? "You have unsaved changes" : "All changes saved"}</span>
            )}
            {dirty && (
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setForm(saved)} disabled={busy}>
                  Discard
                </button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => void onSave()} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
