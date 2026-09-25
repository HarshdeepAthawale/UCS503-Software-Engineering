"use client";

import Link from "next/link";
import { useState } from "react";
import type { RejectionCode, TeamJoinRequestView } from "@/lib/client/api";
import { RejectBar } from "@/components/reject-bar";
import { initials } from "@/lib/client/nav";
import { REJECTION_REASONS, timeAgo } from "@/lib/client/format";

const DECIDED_LABEL: Record<Exclude<TeamJoinRequestView["status"], "PENDING">, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Not accepted",
  WITHDRAWN: "Withdrawn",
};

/**
 * One join request, as the team lead sees it - the same card on the Teams hub
 * and on a team's requests page. Pending requests carry Accept / Not now.
 */
export function JoinRequestCard({
  request,
  teamName,
  busy,
  onDecide,
}: {
  request: TeamJoinRequestView;
  /** Shown when the lead may be looking at requests across several teams. */
  teamName?: string;
  busy: boolean;
  onDecide: (status: "ACCEPTED" | "REJECTED", code?: RejectionCode) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [code, setCode] = useState<RejectionCode>("SEATS_FILLED");
  const reason = REJECTION_REASONS.find((r) => r.value === request.rejectionCode)?.label;

  return (
    <article className="card request-card">
      <span className="avatar" aria-hidden="true">{initials(request.student.name)}</span>
      <div className="request-card-main">
        <p className="request-card-title">
          <Link href={`/profile/${request.student.id}`}>{request.student.name}</Link>
          <span className="field-hint">
            wants <strong>{request.role.label}</strong>
            {teamName ? ` on ${teamName}` : ""} · {timeAgo(request.createdAt)}
          </span>
        </p>
        {request.message && <p className="request-card-msg">“{request.message}”</p>}

        {request.status === "PENDING" ? (
          rejecting ? (
            <RejectBar
              value={code}
              busy={busy}
              onChange={setCode}
              onConfirm={() => onDecide("REJECTED", code)}
              onCancel={() => setRejecting(false)}
            />
          ) : (
            <div className="row-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onDecide("ACCEPTED")}>
                Accept
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRejecting(true)}>
                Not now
              </button>
            </div>
          )
        ) : (
          <span className={`status-pill ${request.status === "ACCEPTED" ? "is-ok" : "is-muted"}`}>
            {DECIDED_LABEL[request.status]}
            {reason ? ` · ${reason}` : ""}
          </span>
        )}
      </div>
    </article>
  );
}
