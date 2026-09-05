"use client";

import { REJECTION_REASONS } from "@/lib/client/format";
import type { RejectionCode } from "@/lib/client/api";

/** Inline reject reason — replaces `prompt()`, which is unusable on mobile. */
export function RejectBar({
  value,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: RejectionCode;
  busy: boolean;
  onChange: (code: RejectionCode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="reject-bar" role="group" aria-label="Rejection reason">
      <select
        aria-label="Rejection reason"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as RejectionCode)}
      >
        {REJECTION_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <button className="mini solid" type="button" disabled={busy} onClick={onConfirm}>
        {busy ? "Saving…" : "Confirm reject"}
      </button>
      <button className="mini" type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
