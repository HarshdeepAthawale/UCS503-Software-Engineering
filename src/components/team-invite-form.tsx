"use client";

import { useState } from "react";
import { apiInviteToTeam, ApiError, type TeamRole } from "@/lib/client/api";
import { openRoles as openOf } from "@/lib/client/team";

/** Invite a classmate by email - shown to the lead on their team's page. */
export function TeamInviteForm({
  teamId,
  teamName,
  roles,
}: {
  teamId: string;
  teamName: string;
  roles: TeamRole[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openRoles = openOf({ roles });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await apiInviteToTeam(teamId, email.trim(), roleId || undefined);
      setNotice(`Invite sent to ${email.trim()}. Code: ${res.inviteCode}`);
      setEmail("");
      setRoleId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invite.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
        Invite by email
      </button>
    );
  }

  return (
    <form className="team-invite-form" onSubmit={(e) => void send(e)}>
      <p className="team-invite-label">Invite to {teamName}</p>
      <div className="team-invite-fields">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their institute email"
          aria-label="Classmate's email"
        />
        {openRoles.length > 0 && (
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            aria-label="Role (optional)"
          >
            <option value="">Any open role</option>
            {openRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} ({r.slotCount - r.slotsFilled} open)
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {notice && <p className="form-ok">{notice}</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
