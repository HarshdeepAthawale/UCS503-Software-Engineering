"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAdminDecideClaim, apiAdminListClaims, ApiError, type PendingAlumniClaim } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { initials } from "@/lib/client/nav";

/** The link's host, only for web links - anything else is shown as text, never made clickable. */
function webHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname : null;
  } catch {
    return null;
  }
}

/** Reasons offered when a claim can't be verified; the alumnus sees the one chosen. */
const REASONS = [
  "The proof link does not open, or needs a sign-in.",
  "The proof does not show a Thapar degree.",
  "The roll number or graduation year does not match institute records.",
  "The name on the proof does not match this account.",
];

/**
 * The alumni claim queue (docs/PRD §4.5): check each claim against institute
 * records, open the proof, then verify the alumnus or say what to fix.
 */
export function AdminClaimsPanel({
  onChanged,
  onNotice,
  onError,
}: {
  onChanged: () => void;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [claims, setClaims] = useState<PendingAlumniClaim[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState(REASONS[0]!);
  const [other, setOther] = useState("");

  const load = useCallback(async () => {
    try {
      setClaims(await apiAdminListClaims());
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not load alumni claims.");
    }
  }, [onError]);

  useEffect(() => void load(), [load]);

  async function decide(c: PendingAlumniClaim, decision: "APPROVED" | "REJECTED") {
    const why = decision === "REJECTED" ? (reason === "other" ? other.trim() : reason) : undefined;
    if (decision === "REJECTED" && !why) {
      onError("Write a reason so the alumnus knows what to fix.");
      return;
    }
    setBusyId(c.id);
    try {
      await apiAdminDecideClaim(c.id, decision, why);
      setRejecting(null);
      await load();
      onChanged();
      onNotice(decision === "APPROVED" ? `${c.user.name} is now a verified alumnus.` : `${c.user.name} has been told what to fix.`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not record the decision.");
    } finally {
      setBusyId(null);
    }
  }

  if (!claims) return <div className="skeleton skeleton-card" aria-busy="true" />;
  if (claims.length === 0) {
    return (
      <div className="empty-card">
        <h3>No claims waiting</h3>
        <p>When a graduate registers as an alumnus and submits proof, it appears here for review.</p>
      </div>
    );
  }

  return (
    <ul className="adm-list">
      {claims.map((c) => {
        const busy = busyId === c.id;
        return (
          <li key={c.id} className="adm-row claim-row">
            <span className="avatar" aria-hidden="true">{initials(c.user.name)}</span>
            <div className="adm-row-main">
              <span className="adm-row-title">{c.user.name}</span>
              <span className="adm-row-meta">{c.user.email} · submitted {timeAgo(c.updatedAt)}</span>
              <dl className="claim-facts">
                <div><dt>Roll number</dt><dd>{c.rollNo}</dd></div>
                <div><dt>Graduated</dt><dd>{c.gradYear}</dd></div>
                <div><dt>Degree</dt><dd>{c.degree}</dd></div>
                <div>
                  <dt>Proof</dt>
                  <dd>
                    {webHost(c.proofUrl) ? (
                      <a href={c.proofUrl} target="_blank" rel="noopener noreferrer nofollow">{webHost(c.proofUrl)}</a>
                    ) : (
                      <span title="Not a web link">{c.proofUrl}</span>
                    )}
                  </dd>
                </div>
              </dl>
              {c.sameRollNo.length > 0 && (
                <p className="claim-warn" role="note">
                  Roll number also used by{" "}
                  {c.sameRollNo
                    .map((s) => `${s.name} (${s.decision === "APPROVED" ? "verified" : s.decision === "REJECTED" ? "not verified" : "pending"})`)
                    .join(", ")}
                  . Check carefully before verifying.
                </p>
              )}
              {rejecting === c.id && (
                <div className="reject-bar" role="group" aria-label="Why the claim can't be verified">
                  <span className="reject-bar-label">Reason</span>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    <option value="other">Something else…</option>
                  </select>
                  {reason === "other" && (
                    <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={500} placeholder="What should they fix?" aria-label="Reason" />
                  )}
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide(c, "REJECTED")}>
                    {busy ? "Sending…" : "Send"}
                  </button>
                  <button type="button" className="btn btn-text btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                </div>
              )}
            </div>
            {rejecting !== c.id && (
              <div className="adm-row-actions">
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                  onClick={() => { setRejecting(c.id); setReason(REASONS[0]!); setOther(""); }}>
                  Can't verify
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void decide(c, "APPROVED")}>
                  Verify alumnus
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
