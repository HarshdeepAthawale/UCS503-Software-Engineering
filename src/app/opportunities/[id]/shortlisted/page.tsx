"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { PageLoading } from "@/components/page-loading";
import { SignInRequired } from "@/components/sign-in-required";
import { ResumeViewer } from "@/components/resume-viewer";
import {
  apiListApplicants,
  apiTransition,
  ApiError,
  bootstrapSession,
  getUser,
  type Applicant,
  type RejectionCode,
} from "@/lib/client/api";
import { RejectBar } from "@/components/reject-bar";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";

// Re-fetches so a student withdrawing an accepted offer (or a stray change
// from another tab) shows up here without a manual reload - see canWithdraw()
// in application-state.ts, which now allows withdrawing from SELECTED too.
const POLL_MS = 8000;

/** Applicant's most relevant "reached this stage" timestamp for a given state. */
function reachedAt(a: Applicant, state: string): string | null {
  const ev = [...a.events].reverse().find((e) => e.toState === state);
  return ev?.createdAt ?? null;
}

export default function ShortlistedCandidatesPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openResume, setOpenResume] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState<RejectionCode>("STRONGER_APPLICANTS");

  const load = useCallback(async () => {
    try {
      setApplicants(await apiListApplicants(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load candidates.");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) await load();
    })();
  }, [load]);

  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [signedIn, load]);

  async function decide(app: Applicant, to: "SELECTED" | "REJECTED") {
    if (to === "REJECTED") {
      setRejectingId(app.id);
      setRejectCode("STRONGER_APPLICANTS");
      return;
    }
    await applyDecision(app, to);
  }

  async function applyDecision(
    app: Applicant,
    to: "SELECTED" | "REJECTED",
    rejectionCode?: RejectionCode,
  ) {
    setError(null);
    setBusyId(app.id);
    try {
      await apiTransition(app.id, to, rejectionCode ? { rejectionCode } : {});
      setRejectingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the application.");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <PageLoading />;
  if (!signedIn) {
    return <SignInRequired message="Sign in to review your shortlist." />;
  }

  // Awaiting a decision: shortlisted, and interviewing (both accept SELECTED/
  // REJECTED directly per the poster transition graph - see application-state.ts).
  const pending = applicants.filter((a) => a.status === "SHORTLISTED" || a.status === "INTERVIEW");
  const selected = applicants.filter((a) => a.status === "SELECTED");

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap">
          <Link href={`/opportunities/${id}/applicants`} className="back-link">
            ← All applicants
          </Link>

          <div className="page-head">
            <div>
              <h1>Shortlisted candidates</h1>
              <p className="sub">{pending.length} awaiting your decision · accept or decline directly.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {pending.length === 0 ? (
            <div className="app-empty">
              <h3>Nothing to decide right now</h3>
              <p>Shortlist an applicant from the applicants list and they'll show up here.</p>
            </div>
          ) : (
            <div className="pipeline" style={{ gridTemplateColumns: "1fr" }}>
              <div className="pcol">
                {pending.map((a) => (
                  <div className="pcard" key={a.id}>
                    <div className="nm">
                      <Link href={`/profile/${a.student.id}`}>{a.student.name}</Link>
                    </div>
                    <div className="tl-meta">
                      {titleCase(a.status)} · applied {timeAgo(a.appliedAt)}
                    </div>
                    {(a.student.branch || a.student.cgpa != null || a.student.backlogs != null) && (
                      <div className="tl-meta">
                        {a.student.branch ?? "Branch not set"}
                        {a.student.cgpa != null ? ` · CGPA ${a.student.cgpa}` : ""}
                        {a.student.backlogs != null
                          ? ` · ${a.student.backlogs} backlog${a.student.backlogs === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    )}
                    <div className="row">
                      <button
                        type="button"
                        className="mini solid"
                        disabled={busyId === a.id}
                        onClick={() => void decide(a, "SELECTED")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="mini"
                        disabled={busyId === a.id}
                        onClick={() => void decide(a, "REJECTED")}
                      >
                        Decline
                      </button>
                    </div>
                    {rejectingId === a.id && (
                      <RejectBar
                        value={rejectCode}
                        busy={busyId === a.id}
                        onChange={setRejectCode}
                        onConfirm={() => void applyDecision(a, "REJECTED", rejectCode)}
                        onCancel={() => setRejectingId(null)}
                      />
                    )}
                    <div className="row">
                      <button
                        type="button"
                        className="mini"
                        onClick={() => setOpenResume((cur) => (cur === a.id ? null : a.id))}
                      >
                        {openResume === a.id ? "Hide résumé" : "View résumé"}
                      </button>
                      <Link className="link-quiet" href={`/applications/${a.id}`}>
                        Message / timeline →
                      </Link>
                    </div>
                    {openResume === a.id && (
                      <div className="row" style={{ display: "block" }}>
                        <ResumeViewer userId={a.student.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="page-head" style={{ marginTop: 40 }}>
            <div>
              <h1 style={{ fontSize: 22 }}>Selected</h1>
              <p className="sub">
                {selected.length} accepted · this list updates on its own if someone declines.
              </p>
            </div>
          </div>

          {selected.length === 0 ? (
            <p className="empty-note">No one has been selected yet.</p>
          ) : (
            <div className="notif-list">
              {selected.map((a) => (
                <Link key={a.id} href={`/profile/${a.student.id}`} className="notif">
                  <span className="body">
                    <span className="t">{a.student.name}</span>
                    <span className="when">
                      {a.student.branch ?? "Branch not set"}
                      {a.student.cgpa != null ? ` · CGPA ${a.student.cgpa}` : ""}
                      {" · selected "}
                      {(() => {
                        const at = reachedAt(a, "SELECTED");
                        return at ? timeAgo(at) : "recently";
                      })()}
                    </span>
                  </span>
                  <span className={`pill ${statusClass("SELECTED")}`}>Selected</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
