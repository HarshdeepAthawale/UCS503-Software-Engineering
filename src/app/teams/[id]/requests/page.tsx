"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiDecideTeamRequest,
  apiListTeamRequests,
  ApiError,
  bootstrapSession,
  getUser,
  type RejectionCode,
  type TeamJoinRequestView,
} from "@/lib/client/api";
import { RejectBar } from "@/components/reject-bar";
import { timeAgo, titleCase } from "@/lib/client/format";

/** The team lead's inbox of join requests across every role (T-22). */
export default function TeamRequestsPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [requests, setRequests] = useState<TeamJoinRequestView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState<RejectionCode>("SEATS_FILLED");

  const load = useCallback(async () => {
    try {
      setRequests(await apiListTeamRequests(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load requests - only the team lead can view this.");
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

  async function decide(reqId: string, status: "ACCEPTED" | "REJECTED", code?: RejectionCode) {
    setError(null);
    setBusyId(reqId);
    try {
      await apiDecideTeamRequest(id, reqId, status, code);
      setRejectingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this request.");
    } finally {
      setBusyId(null);
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

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap">
          <Link href={`/teams/${id}`} className="back-link">← Back to team</Link>
          <div className="page-head">
            <div>
              <h1>Join requests</h1>
              <p className="sub">{pending.length} pending of {requests.length} total.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {requests.length === 0 ? (
            <div className="app-empty"><h3>No requests yet</h3></div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Role</th>
                    <th>Message</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pending, ...decided].map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/profile/${r.student.id}`}>{r.student.name}</Link></td>
                      <td>{r.role.label}</td>
                      <td>{r.message ?? "—"}</td>
                      <td>{timeAgo(r.createdAt)}</td>
                      <td>
                        {titleCase(r.status)}
                        {r.rejectionCode && <div className="tl-meta">{titleCase(r.rejectionCode)}</div>}
                      </td>
                      <td>
                        {r.status === "PENDING" && (
                          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                            <button
                              type="button"
                              className="mini solid"
                              disabled={busyId === r.id}
                              onClick={() => void decide(r.id, "ACCEPTED")}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="mini"
                              disabled={busyId === r.id}
                              onClick={() => { setRejectingId(r.id); setRejectCode("SEATS_FILLED"); }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {rejectingId === r.id && (
                          <RejectBar
                            value={rejectCode}
                            busy={busyId === r.id}
                            onChange={setRejectCode}
                            onConfirm={() => void decide(r.id, "REJECTED", rejectCode)}
                            onCancel={() => setRejectingId(null)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
