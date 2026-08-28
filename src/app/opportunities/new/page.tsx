"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiCreateOpportunity,
  apiGetSkills,
  ApiError,
  bootstrapSession,
  getUser,
  type OppType,
  type SkillRequirement,
  type SlaPledge,
  type TaxonomySkill,
} from "@/lib/client/api";
import { oppTypeLabel } from "@/lib/client/format";

const TYPES: OppType[] = ["RESEARCH", "INTERNSHIP", "TA", "HACKATHON_TEAM", "MICRO_TASK", "REFERRAL"];
const PLEDGES: { value: SlaPledge; label: string }[] = [
  { value: "H24", label: "Reply within 24 hours" },
  { value: "H48", label: "Reply within 48 hours" },
  { value: "WEEK", label: "Reply within a week" },
];

interface PickedSkill {
  skillId: string;
  requirement: SkillRequirement;
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);

  const [type, setType] = useState<OppType>("RESEARCH");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [duration, setDuration] = useState("");
  const [stipend, setStipend] = useState(false);
  const [seatCount, setSeatCount] = useState("1");
  const [deadline, setDeadline] = useState("");
  const [slaPledge, setSlaPledge] = useState<SlaPledge>("H48");
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  const [pick, setPick] = useState("");
  const [pickReq, setPickReq] = useState<SkillRequirement>("REQUIRED");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      const role = getUser()?.role;
      const canPost = ok && (role === "FACULTY" || role === "ALUMNI");
      setAllowed(canPost);
      setReady(true);
      if (canPost) {
        try {
          setTaxonomy(await apiGetSkills());
        } catch {
          /* taxonomy optional */
        }
      }
    })();
  }, []);

  function addSkill() {
    if (!pick) return;
    setSkills((prev) => [...prev.filter((s) => s.skillId !== pick), { skillId: pick, requirement: pickReq }]);
    setPick("");
    setPickReq("REQUIRED");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiCreateOpportunity({
        type,
        title: title.trim(),
        description: description.trim(),
        domain: domain.trim(),
        duration: duration.trim() || null,
        stipend,
        seatCount: Number(seatCount) || 1,
        deadline: new Date(deadline).toISOString(),
        slaPledge,
        skills: skills.length ? skills : undefined,
      });
      router.push(`/opportunities/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this posting.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main className="app-page">
          <div className="wrap app-empty">
            <h3>Only faculty and approved alumni can post</h3>
            <p>Students discover and apply; posting is for opportunity owners.</p>
            <Link className="btn btn-ghost" href="/opportunities">← Back to feed</Link>
          </div>
        </main>
      </div>
    );
  }

  const skillById = new Map(taxonomy.map((t) => [t.id, t]));
  const available = taxonomy.filter((t) => !skills.some((s) => s.skillId === t.id));

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main className="app-page">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="page-head">
            <div>
              <h1>Post an opportunity</h1>
              <p className="sub">Structured fields and an SLA pledge — applicants can hold you to it.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          <form className="panel form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={title} maxLength={140} required onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NLP Research Assistant" />
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value as OppType)}>
                {TYPES.map((t) => <option key={t} value={t}>{oppTypeLabel(t)}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea id="description" value={description} maxLength={5000} required onChange={(e) => setDescription(e.target.value)} placeholder="What the work is, what you're looking for, expectations…" style={{ minHeight: 140 }} />
            </div>
            <div className="field">
              <label htmlFor="domain">Domain</label>
              <input id="domain" value={domain} maxLength={80} required onChange={(e) => setDomain(e.target.value)} placeholder="e.g. Machine Learning" />
            </div>
            <div className="field">
              <label htmlFor="duration">Duration (optional)</label>
              <input id="duration" value={duration} maxLength={80} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 months" />
            </div>
            <div className="check-row">
              <input id="stipend" type="checkbox" checked={stipend} onChange={(e) => setStipend(e.target.checked)} />
              <label htmlFor="stipend">This opportunity offers a stipend</label>
            </div>
            <div className="field">
              <label htmlFor="seats">Seats</label>
              <input id="seats" type="number" min={1} max={500} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="deadline">Application deadline</label>
              <input id="deadline" type="datetime-local" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sla">SLA pledge</label>
              <select id="sla" value={slaPledge} onChange={(e) => setSlaPledge(e.target.value as SlaPledge)}>
                {PLEDGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Required / preferred skills (optional)</label>
              <div className="skills-current" style={{ marginBottom: 10 }}>
                {skills.length === 0 && <p className="empty-note">No skills tagged yet.</p>}
                {skills.map((s) => (
                  <span key={s.skillId} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
                    {skillById.get(s.skillId)?.name ?? s.skillId.slice(0, 8)} · {s.requirement === "REQUIRED" ? "Required" : "Preferred"}
                    <span className="x" role="button" tabIndex={0} aria-label="Remove skill"
                      onClick={() => setSkills((p) => p.filter((x) => x.skillId !== s.skillId))}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSkills((p) => p.filter((x) => x.skillId !== s.skillId)); }}>×</span>
                  </span>
                ))}
              </div>
              <div className="skill-add-row">
                <select aria-label="Pick a skill" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose a skill…</option>
                  {available.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.domain}</option>)}
                </select>
                <select aria-label="Requirement" value={pickReq} onChange={(e) => setPickReq(e.target.value as SkillRequirement)}>
                  <option value="REQUIRED">Required</option>
                  <option value="PREFERRED">Preferred</option>
                </select>
                <button className="mini solid" type="button" onClick={addSkill} disabled={!pick}>Add</button>
              </div>
            </div>

            <div className="save-bar">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Publishing…" : "Publish opportunity"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
