"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { SignInRequired } from "@/components/sign-in-required";
import {
  apiDecideTeamRequest,
  apiListTeamRequests,
  ApiError,
  bootstrapSession,
  getUser,
  type RejectionCode,
  type TeamJoinRequestView,
} from "@/lib/client/api";
import { JoinRequestCard } from "@/components/join-request-card";

/** The team lead's inbox of join requests across every role (T-22). */
export default function TeamRequestsPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [requests, setRequests] = useState<TeamJoinRequestView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this request.");
    } finally {
      setBusyId(null);
    }
  }

  if (ready && !signedIn) {
    return <SignInRequired message="Sign in to review join requests." />;
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <Link href={`/teams/${id}`} className="back-link">← Back to team</Link>
          <div className="page-title-row">
            <div>
              <h1>Join requests</h1>
              <p className="sub">{pending.length} waiting for you · {requests.length} in total</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready ? (
            <div className="skeleton skeleton-card" aria-busy="true" />
          ) : requests.length === 0 ? (
            <div className="empty-card">
              <h3>No requests yet</h3>
              <p>Students who ask for a spot on your team show up here.</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <section className="request-list" aria-label="Waiting for you">
                  {pending.map((r) => (
                    <JoinRequestCard key={r.id} request={r} busy={busyId === r.id}
                      onDecide={(status, code) => void decide(r.id, status, code)} />
                  ))}
                </section>
              )}
              {decided.length > 0 && (
                <section aria-labelledby="decided-heading">
                  <div className="block-head">
                    <h2 id="decided-heading">Already decided</h2>
                  </div>
                  <div className="request-list">
                    {decided.map((r) => (
                      <JoinRequestCard key={r.id} request={r} busy={false} onDecide={() => {}} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
