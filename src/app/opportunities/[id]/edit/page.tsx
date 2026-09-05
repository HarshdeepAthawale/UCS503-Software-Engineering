"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiGetOpportunity,
  apiGetSkills,
  apiUpdateOpportunity,
  ApiError,
  bootstrapSession,
  getUser,
  type Opportunity,
  type SkillRequirement,
  type SlaPledge,
  type TaxonomySkill,
} from "@/lib/client/api";
import { oppTypeLabel } from "@/lib/client/format";
import { BRANCHES } from "@/lib/domain/branch";

const PLEDGES: { value: SlaPledge; label: string }[] = [
  { value: "H24", label: "Reply within 24 hours" },
  { value: "H48", label: "Reply within 48 hours" },
  { value: "WEEK", label: "Reply within a week" },
];

interface PickedSkill {
  skillId: string;
  requirement: SkillRequirement;
}

/** ISO timestamp -> the local `datetime-local` input format (no timezone, minute precision). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditOpportunityPage() {
  const router = useRouter();
  const id = useParams<{ id: string }>().id;

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[]>([]);

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
  const [eligibleBranches, setEligibleBranches] = useState<string[]>([]);
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (!ok) {
        setReady(true);
        return;
      }
      try {
        const [opp, tax] = await Promise.all([
          apiGetOpportunity(id),
          apiGetSkills().catch(() => [] as TaxonomySkill[]),
        ]);
        const user = getUser();
        const owns = user?.id === opp.poster.id || user?.role === "ADMIN";
        if (!owns) {
          setForbidden(true);
          setReady(true);
          return;
        }
        setOpportunity(opp);
        setTaxonomy(tax);
        setTitle(opp.title);
        setDescription(opp.description);
        setDomain(opp.domain);
        setDuration(opp.duration ?? "");
        setStipend(opp.stipend);
        setSeatCount(String(opp.seatCount));
        setDeadline(toLocalInputValue(opp.deadline));
        setSlaPledge(opp.slaPledge);
        setSkills(opp.skills.map((s) => ({ skillId: s.id, requirement: s.requirement })));
        setEligibleBranches(opp.eligibleBranches);
        setMinCgpa(opp.minCgpa != null ? String(opp.minCgpa) : "");
        setMaxBacklogs(opp.maxBacklogs != null ? String(opp.maxBacklogs) : "");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(err instanceof ApiError ? err.message : "Could not load this posting.");
      } finally {
        setReady(true);
      }
    })();
  }, [id]);

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
      await apiUpdateOpportunity(id, {
        title: title.trim(),
        description: description.trim(),
        domain: domain.trim(),
        duration: duration.trim() || null,
        stipend,
        seatCount: Number(seatCount) || 1,
        deadline: new Date(deadline).toISOString(),
        slaPledge,
        skills,
        eligibleBranches,
        minCgpa: minCgpa ? Number(minCgpa) : null,
        maxBacklogs: maxBacklogs ? Number(maxBacklogs) : null,
      });
      router.push(`/opportunities/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save these changes.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;

  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/login">Sign in</Link></div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page">
          <div className="wrap app-empty">
            <h3>Posting not found</h3>
            <Link className="btn btn-ghost" href="/opportunities">← Back to feed</Link>
          </div>
        </main>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page">
          <div className="wrap app-empty">
            <h3>Only the poster can edit this</h3>
            <Link className="btn btn-ghost" href={`/opportunities/${id}`}>← Back to posting</Link>
          </div>
        </main>
      </div>
    );
  }

  const locked = opportunity?.status === "EXPIRED" || opportunity?.status === "CLOSED";
  const skillById = new Map(taxonomy.map((t) => [t.id, t]));
  const available = taxonomy.filter((t) => !skills.some((s) => s.skillId === t.id));

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <Link href={`/opportunities/${id}`} className="back-link">
            ← Back to posting
          </Link>
          <div className="page-head">
            <div>
              <h1>Edit posting</h1>
              <p className="sub">
                {opportunity ? oppTypeLabel(opportunity.type) : ""} — the type can&apos;t be changed after publishing.
              </p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {locked ? (
            <div className="app-empty">
              <h3>This posting is no longer editable</h3>
              <p>
                {opportunity?.status === "EXPIRED"
                  ? "Its deadline has passed."
                  : "It has been closed."}{" "}
                Expired and closed postings are frozen so the applicant history stays accurate.
              </p>
            </div>
          ) : (
            <form className="panel form" onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" value={title} maxLength={140} required onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea id="description" value={description} maxLength={5000} required onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 140 }} />
              </div>
              <div className="field">
                <label htmlFor="domain">Domain</label>
                <input id="domain" value={domain} maxLength={80} required onChange={(e) => setDomain(e.target.value)} />
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
                <input id="seats" type="number" min={opportunity?.seatsFilled || 1} max={500} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
                {opportunity && opportunity.seatsFilled > 0 && (
                  <p className="empty-note">{opportunity.seatsFilled} already filled — seats can&apos;t drop below that.</p>
                )}
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
                <p className="empty-note">e.g. 0 for no backlogs, 1 to allow up to one. Leave blank for no cap.</p>
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
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <Link className="btn btn-ghost" href={`/opportunities/${id}`}>Cancel</Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
