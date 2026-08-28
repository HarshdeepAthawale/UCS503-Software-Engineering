"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListApplicants,
  apiTransition,
  ApiError,
  bootstrapSession,
  getUser,
  type Applicant,
  type AppState,
  type RejectionCode,
} from "@/lib/client/api";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";

// Which forward moves a poster may make from each state (mirrors the server).
const NEXT: Record<string, Exclude<AppState, "APPLIED" | "WITHDRAWN">[]> = {
  APPLIED: ["RECEIVED", "SHORTLISTED", "REJECTED"],
  RECEIVED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "SELECTED", "REJECTED"],
  INTERVIEW: ["SELECTED", "REJECTED"],
};
const COLUMNS: AppState[] = [
  "APPLIED",
  "RECEIVED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];
const ACTION_LABEL: Record<string, string> = {
  RECEIVED: "Mark received",
  SHORTLISTED: "Shortlist",
  INTERVIEW: "Interview",
  SELECTED: "Select",
  REJECTED: "Reject",
};

export default function ApplicantsPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setApplicants(await apiListApplicants(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applicants.");
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

  async function move(app: Applicant, to: Exclude<AppState, "APPLIED" | "WITHDRAWN">) {
    setError(null);
    setBusyId(app.id);
    try {
      const rejectionCode =
        to === "REJECTED"
          ? ((prompt(
              "Rejection reason code (SKILL_MISMATCH, SEATS_FILLED, TIMING_CONFLICT, PROFILE_INCOMPLETE, STRONGER_APPLICANTS, OTHER):",
              "STRONGER_APPLICANTS",
            ) || "OTHER") as RejectionCode)
          : undefined;
      await apiTransition(app.id, to, rejectionCode ? { rejectionCode } : {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the application.");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card"><h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/login">Sign in</Link></div>
        </div>
      </main>
    );
  }

  const byState = (s: AppState) => applicants.filter((a) => a.status === s);

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main className="app-page">
        <div className="wrap">
          <Link href={`/opportunities/${id}`} className="appnav-link" style={{ marginBottom: 16, display: "inline-flex" }}>
            ← Back to posting
          </Link>
          <div className="page-head">
            <div>
              <h1>Applicant pipeline</h1>
              <p className="sub">{applicants.length} applicant{applicants.length === 1 ? "" : "s"} · move each toward a decision.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {applicants.length === 0 ? (
            <div className="app-empty"><h3>No applicants yet</h3><p>They'll appear here as students apply.</p></div>
          ) : (
            <div className="pipeline">
              {COLUMNS.map((col) => {
                const list = byState(col);
                return (
                  <div className="pcol" key={col}>
                    <h4><span>{titleCase(col)}</span><span>{list.length}</span></h4>
                    {list.map((a) => (
                      <div className="pcard" key={a.id}>
                        <div className="nm">{a.student.name}</div>
                        <div className="tl-meta">Applied {timeAgo(a.appliedAt)}</div>
                        {a.rejectionCode && (
                          <div className="tl-meta">Reason: {titleCase(a.rejectionCode)}</div>
                        )}
                        <div className="row">
                          <span className={`pill ${statusClass(a.status)}`}>{titleCase(a.status)}</span>
                        </div>
                        {NEXT[a.status] && (
                          <div className="row">
                            {NEXT[a.status]!.map((to) => (
                              <button
                                key={to}
                                type="button"
                                className={`mini${to === "REJECTED" ? "" : " solid"}`}
                                disabled={busyId === a.id}
                                onClick={() => void move(a, to)}
                              >
                                {ACTION_LABEL[to]}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="row">
                          <Link className="appnav-link" style={{ padding: "4px 8px", fontSize: 12 }} href={`/applications/${a.id}`}>
                            Message / timeline →
                          </Link>
                        </div>
                      </div>
                    ))}
                    {list.length === 0 && <p className="empty-note" style={{ fontSize: 12 }}>—</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
