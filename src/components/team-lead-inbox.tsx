"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiDecideTeamRequest,
  apiListTeamRequests,
  ApiError,
  type RejectionCode,
  type Team,
  type TeamJoinRequestView,
} from "@/lib/client/api";
import { JoinRequestCard } from "@/components/join-request-card";

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
      await load();
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this request.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || pending.length === 0) return null;

  return (
    <section aria-labelledby="team-inbox-heading">
      <div className="block-head">
        <h2 id="team-inbox-heading">Requests to review</h2>
        <span className="block-count">{pending.length}</span>
      </div>
      {error && <p className="form-err" role="alert">{error}</p>}
      <div className="request-list">
        {pending.map((r) => (
          <JoinRequestCard
            key={r.id}
            request={r}
            teamName={leadTeams.length > 1 ? r.teamName : undefined}
            busy={busyId === r.id}
            onDecide={(status, code) => void decide(r.teamId, r.id, status, code)}
          />
        ))}
      </div>
    </section>
  );
}
