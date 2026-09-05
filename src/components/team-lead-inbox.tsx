"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  apiDecideTeamRequest,
  apiListTeamRequests,
  ApiError,
  type RejectionCode,
  type Team,
  type TeamJoinRequestView,
} from "@/lib/client/api";
import { RejectBar } from "@/components/reject-bar";
import { timeAgo } from "@/lib/client/format";

type PendingRow = TeamJoinRequestView & { teamId: string; teamName: string };

type TeamLeadInboxProps = {
  leadTeams: Team[];
  onDecided: () => void;
};

/** Pending join requests for teams the viewer leads — accept/reject on the hub page. */
export function TeamLeadInbox({ leadTeams, onDecided }: TeamLeadInboxProps) {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState<RejectionCode>("SEATS_FILLED");

  const load = useCallback(async () => {
    if (leadTeams.length === 0) {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const batches = await Promise.all(
        leadTeams.map(async (t) => {
          const reqs = await apiListTeamRequests(t.id);
          return reqs
            .filter((r) => r.status === "PENDING")
            .map((r) => ({ ...r, teamId: t.id, teamName: t.name }));
        }),
      );
      setPending(batches.flat());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load join requests.");
    } finally {
      setLoading(false);
    }
  }, [leadTeams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(teamId: string, reqId: string, status: "ACCEPTED" | "REJECTED", code?: RejectionCode) {
    setError(null);
    setBusyId(reqId);
    try {
      await apiDecideTeamRequest(teamId, reqId, status, code);
      setRejectingId(null);
      await load();
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this request.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="empty-note">Loading requests…</p>;
  if (pending.length === 0) return null;

  return (
    <section className="teams-section" aria-labelledby="team-inbox-heading">
      <div className="teams-section-head">
        <h2 id="team-inbox-heading">Requests to review</h2>
        <p className="sub">Students asking to join your teams — accept or reject here.</p>
      </div>
      {error && <p className="form-err" role="alert">{error}</p>}
      <div className="team-inbox-list">
        {pending.map((r) => (
          <article key={r.id} className="panel team-inbox-row">
            <div className="team-inbox-main">
              <Link href={`/profile/${r.student.id}`} className="team-inbox-name">
                {r.student.name}
              </Link>
              <p className="empty-note">
                Wants <strong>{r.role.label}</strong> on {r.teamName} · {timeAgo(r.createdAt)}
              </p>
              {r.message && <p className="team-inbox-msg">{r.message}</p>}
            </div>
            <div className="team-inbox-actions">
              {rejectingId === r.id ? (
                <RejectBar
                  value={rejectCode}
                  busy={busyId === r.id}
                  onChange={setRejectCode}
                  onConfirm={() => void decide(r.teamId, r.id, "REJECTED", rejectCode)}
                  onCancel={() => setRejectingId(null)}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="mini solid"
                    disabled={busyId === r.id}
                    onClick={() => void decide(r.teamId, r.id, "ACCEPTED")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="mini"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setRejectingId(r.id);
                      setRejectCode("SEATS_FILLED");
                    }}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
