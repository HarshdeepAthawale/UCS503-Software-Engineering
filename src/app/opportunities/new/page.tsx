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
import { OpportunityTypeSelect } from "@/components/opportunity-type-select";
import { FormSelect } from "@/components/form-select";
import { SkillAddRow } from "@/components/skill-add-row";
import { BRANCHES } from "@/lib/domain/branch";
import { cleanTaxonomySkills } from "@/lib/domain/skill-taxonomy";

const PLEDGES: { value: SlaPledge; label: string; hint: string }[] = [
  { value: "H24", label: "Reply within 24 hours", hint: "Best for urgent shortlists" },
  { value: "H48", label: "Reply within 48 hours", hint: "Recommended default" },
  { value: "WEEK", label: "Reply within a week", hint: "For longer review cycles" },
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
  const [stipendAmount, setStipendAmount] = useState("");
  const [seatCount, setSeatCount] = useState("1");
  const [deadline, setDeadline] = useState("");
  const [slaPledge, setSlaPledge] = useState<SlaPledge>("H48");
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  const [pick, setPick] = useState("");
  const [pickReq, setPickReq] = useState<SkillRequirement>("REQUIRED");
  const [eligibleBranches, setEligibleBranches] = useState<string[]>([]);
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");

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
          setTaxonomy(cleanTaxonomySkills(await apiGetSkills()));
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
        stipendAmount: stipend && stipendAmount ? Number(stipendAmount) : null,
        seatCount: Number(seatCount) || 1,
        deadline: new Date(deadline).toISOString(),
        slaPledge,
        skills: skills.length ? skills : undefined,
        eligibleBranches: eligibleBranches.length ? eligibleBranches : undefined,
        minCgpa: minCgpa ? Number(minCgpa) : undefined,
        maxBacklogs: maxBacklogs ? Number(maxBacklogs) : undefined,
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
        <main id="content" className="app-page">
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
      <main id="content" className="app-page">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="page-head">
            <div>
              <h1>Post an opportunity</h1>
              <p className="sub">Say how quickly you will reply - applicants see whether you keep to it.</p>
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
              <OpportunityTypeSelect id="type" value={type} onChange={(v) => setType(v as OppType)} />
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
              <input
                id="stipend"
                type="checkbox"
                checked={stipend}
                onChange={(e) => {
                  setStipend(e.target.checked);
                  if (!e.target.checked) setStipendAmount("");
                }}
              />
              <label htmlFor="stipend">This opportunity offers a stipend</label>
            </div>
            {stipend && (
              <div className="field">
                <label htmlFor="stipendAmount">Monthly stipend (₹)</label>
                <input
                  id="stipendAmount"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={stipendAmount}
                  onChange={(e) => setStipendAmount(e.target.value)}
                  placeholder="e.g. 15000"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="seats">Seats</label>
              <input id="seats" type="number" min={1} max={500} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="deadline">Application deadline</label>
              <input id="deadline" type="datetime-local" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sla">Reply within</label>
              <FormSelect
                id="sla"
                value={slaPledge}
                onChange={(v) => setSlaPledge(v as SlaPledge)}
                options={PLEDGES.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
                placeholder="Select reply window"
              />
            </div>

            <div className="field">
              <label>Eligible branches (optional)</label>
              <p className="empty-note" style={{ marginBottom: 8 }}>
                Leave every box unchecked to accept applicants from any branch.
              </p>
              <div className="check-row" style={{ flexWrap: "wrap", gap: "6px 16px" }}>
                {BRANCHES.map((b) => (
                  <label key={b} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={eligibleBranches.includes(b)}
                      onChange={(e) =>
                        setEligibleBranches((prev) =>
                          e.target.checked ? [...prev, b] : prev.filter((x) => x !== b),
                        )
                      }
                    />
                    {b}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="minCgpa">Minimum CGPA (optional)</label>
              <input
                id="minCgpa"
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>
            <div className="field">
              <label htmlFor="maxBacklogs">Maximum active backlogs allowed (optional)</label>
              <input
                id="maxBacklogs"
                type="number"
                min={0}
                max={50}
                value={maxBacklogs}
                onChange={(e) => setMaxBacklogs(e.target.value)}
                placeholder="e.g. 0"
              />
              <p className="empty-note">
                e.g. 0 for no backlogs, 1 to allow up to one. Leave blank for no cap.
              </p>
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
              <SkillAddRow
                available={available}
                pick={pick}
                pickReq={pickReq}
                onPickChange={setPick}
                onPickReqChange={setPickReq}
                onAdd={addSkill}
              />
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
