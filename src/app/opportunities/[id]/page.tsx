"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiApply,
  apiCloseOpportunity,
  apiFlagOpportunity,
  apiGetMyProfile,
  apiGetOpportunity,
  ApiError,
  bootstrapSession,
  getUser,
  type FlagReason,
  type Opportunity,
  type Profile,
} from "@/lib/client/api";

const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "MISLEADING", label: "Misleading / false details" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "DUPLICATE", label: "Duplicate posting" },
  { value: "OTHER", label: "Other" },
];
import {
  badgeLabel,
  closesLabel,
  oppTypeLabel,
  slaLabel,
  statusClass,
  stipendLabel,
  titleCase,
  ttaLabel,
} from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<FlagReason>("MISLEADING");
  const [reportDetail, setReportDetail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reported, setReported] = useState(false);

  const load = useCallback(async () => {
    try {
      setOpp(await apiGetOpportunity(id));
    } catch (err) {
      if (handleLoadError(router, err)) return;
      setError(loadErrorMessage(err, "Could not load this opportunity."));
    }
  }, [id, router]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (!ok) return;
      await load();
      // Needed to compute branch/CGPA eligibility client-side (T-09 filters);
      // the server re-checks on submit regardless, so a stale/failed fetch here
      // only affects whether we can hide the button early, not correctness.
      if (getUser()?.role === "STUDENT") {
        try {
          setMyProfile(await apiGetMyProfile());
        } catch {
          /* eligibility preview is optional */
        } finally {
          setProfileLoaded(true);
        }
      } else {
        setProfileLoaded(true);
      }
    })();
  }, [load]);

  async function onApply() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiApply(id, note.trim() || undefined);
      setNotice("Application submitted. Track it under Applications.");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply.");
    } finally {
      setBusy(false);
    }
  }

  async function onReport() {
    setError(null);
    setReportBusy(true);
    try {
      await apiFlagOpportunity(id, {
        reason: reportReason,
        detail: reportDetail.trim() || undefined,
      });
      setReported(true);
      setReportOpen(false);
      setReportDetail("");
      setNotice("Thanks — this posting has been reported to the moderators.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the report.");
    } finally {
      setReportBusy(false);
    }
  }

  async function onClose() {
    if (!confirm("Close this posting? Students can no longer apply.")) return;
    setBusy(true);
    try {
      await apiCloseOpportunity(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close.");
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
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();
  const isOwner = !!opp && user?.id === opp.poster.id;
  const isStudent = user?.role === "STUDENT";
  const open = opp?.status === "LIVE" || opp?.status === "AT_RISK";
  const badge = opp?.poster.responsiveness?.badge;

  // Eligibility filters (docs/PRD M3) - mirrors the check in application.service.ts
  // so the button can be hidden for a student who won't pass it anyway. This is
  // UX only; the server is the authoritative check on submit.
  const ineligibleReasons: string[] = [];
  if (opp && isStudent) {
    if (opp.eligibleBranches.length > 0) {
      if (!myProfile?.branch || !opp.eligibleBranches.includes(myProfile.branch)) {
        ineligibleReasons.push(`restricted to ${opp.eligibleBranches.join(", ")}`);
      }
    }
    if (opp.minCgpa != null) {
      if (myProfile?.cgpa == null || myProfile.cgpa < opp.minCgpa) {
        ineligibleReasons.push(`requires a minimum CGPA of ${opp.minCgpa}`);
      }
    }
    if (opp.maxBacklogs != null) {
      if (myProfile?.backlogs == null || myProfile.backlogs > opp.maxBacklogs) {
        ineligibleReasons.push(`requires ${opp.maxBacklogs} or fewer active backlogs`);
      }
    }
  }
  const eligible = ineligibleReasons.length === 0;

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <Link href="/opportunities" className="back-link">
            ← Back to feed
          </Link>

          {error && <p className="form-err" role="alert">{error}</p>}
          {notice && <p className="form-ok">{notice}</p>}

          {!opp ? (
            <p className="app-loading">Loading…</p>
          ) : (
            <div className="detail-grid">
              <div className="panel detail-body">
                <div className="ocard-top" style={{ marginBottom: 4 }}>
                  <span className="ocard-type">{oppTypeLabel(opp.type)}</span>
                  <span className={`pill ${statusClass(opp.status)}`}>{titleCase(opp.status)}</span>
                </div>
                <h1>{opp.title}</h1>
                <p className="lede">{opp.description}</p>

                {opp.skills.length > 0 && (
                  <>
                    <h2 style={{ fontSize: 15, marginTop: 24, marginBottom: 10 }}>Skills</h2>
                    <div className="tagrow">
                      {opp.skills.map((s) => (
                        <span key={s.id} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
                          {s.name} · {titleCase(s.requirement)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <aside className="panel">
                <div className="kv"><span className="k">Posted by</span><span className="v"><Link href={`/profile/${opp.poster.id}`}>{opp.poster.name}</Link></span></div>
                <div className="kv"><span className="k">Domain</span><span className="v">{opp.domain}</span></div>
                <div className="kv"><span className="k">Stipend</span><span className="v">{stipendLabel(opp.stipend, opp.stipendAmount)}</span></div>
                {opp.duration && <div className="kv"><span className="k">Duration</span><span className="v">{opp.duration}</span></div>}
                <div className="kv"><span className="k">Seats</span><span className="v">{opp.seatCount - opp.seatsFilled} of {opp.seatCount} open</span></div>
                <div className="kv"><span className="k">Deadline</span><span className="v">{closesLabel(opp.deadline)}</span></div>
                <div className="kv"><span className="k">SLA pledge</span><span className="v">{slaLabel(opp.slaPledge)}</span></div>
                {opp.eligibleBranches.length > 0 && (
                  <div className="kv"><span className="k">Eligible branches</span><span className="v">{opp.eligibleBranches.join(", ")}</span></div>
                )}
                {opp.minCgpa != null && (
                  <div className="kv"><span className="k">Min CGPA</span><span className="v">{opp.minCgpa}</span></div>
                )}
                {opp.maxBacklogs != null && (
                  <div className="kv"><span className="k">Max backlogs</span><span className="v">{opp.maxBacklogs}</span></div>
                )}
                {badge && (
                  <div className="kv">
                    <span className="k">Responsiveness</span>
                    <span className="v">
                      <span className={`rbadge b-${badge.toLowerCase()}`}>{badgeLabel(badge)}</span>
                    </span>
                  </div>
                )}
                {badge && opp.poster.responsiveness?.medianTtaHours != null && (
                  <div className="kv"><span className="k">Median reply</span><span className="v">{ttaLabel(opp.poster.responsiveness.medianTtaHours)}</span></div>
                )}

                <div style={{ marginTop: 18 }}>
                  {isOwner ? (
                    <div className="hero-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <Link className="btn btn-primary" href={`/opportunities/${id}/applicants`}>Manage applicants</Link>
                      <Link className="btn btn-ghost" href={`/opportunities/${id}/shortlisted`}>Shortlisted candidates</Link>
                      <Link className="btn btn-ghost" href={`/opportunities/${id}/edit`}>Edit posting</Link>
                      {opp.status !== "CLOSED" && opp.status !== "EXPIRED" && (
                        <button className="btn btn-danger" type="button" onClick={onClose} disabled={busy}>Close posting</button>
                      )}
                    </div>
                  ) : isStudent && open && !profileLoaded ? (
                    <p className="empty-note">Checking eligibility…</p>
                  ) : isStudent && open && !eligible ? (
                    <div>
                      <p className="empty-note">
                        You don't meet this posting's eligibility criteria: {ineligibleReasons.join("; ")}.
                      </p>
                      <p className="empty-note">
                        <Link href="/profile">Update your profile</Link> if this doesn't look right.
                      </p>
                    </div>
                  ) : isStudent && open ? (
                    <div className="form">
                      <div className="field">
                        <label htmlFor="note">Add a short note (optional)</label>
                        <textarea id="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Why you're a fit…" />
                      </div>
                      <button className="btn btn-primary" type="button" onClick={onApply} disabled={busy}>
                        {busy ? "Submitting…" : "Apply now"}
                      </button>
                    </div>
                  ) : isStudent ? (
                    <p className="empty-note">This posting is not accepting applications.</p>
                  ) : (
                    <p className="empty-note">Only students can apply to opportunities.</p>
                  )}
                </div>

                {!isOwner && user?.role !== "ADMIN" && (
                  <div className="report-block">
                    {reported ? (
                      <p className="empty-note">You reported this posting.</p>
                    ) : !reportOpen ? (
                      <button type="button" className="linklike-muted" onClick={() => setReportOpen(true)}>
                        Report this posting
                      </button>
                    ) : (
                      <div className="form">
                        <div className="field">
                          <label htmlFor="rr">Reason</label>
                          <select id="rr" value={reportReason} onChange={(e) => setReportReason(e.target.value as FlagReason)}>
                            {FLAG_REASONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="rd">Details (optional)</label>
                          <textarea id="rd" value={reportDetail} maxLength={500} onChange={(e) => setReportDetail(e.target.value)} placeholder="What's wrong with this posting?" />
                        </div>
                        <div className="row">
                          <button className="mini" type="button" onClick={() => setReportOpen(false)} disabled={reportBusy}>Cancel</button>
                          <button className="mini solid" type="button" onClick={onReport} disabled={reportBusy}>
                            {reportBusy ? "Reporting…" : "Submit report"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
