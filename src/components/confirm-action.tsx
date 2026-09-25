"use client";

import { useState } from "react";

/**
 * A button that asks "Sure?" in place before a consequential action - no
 * browser confirm() dialog, which is jarring and easy to click through.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel = "Confirm",
  onConfirm,
  busy = false,
  danger = false,
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={`btn btn-sm ${danger ? "btn-text confirm-danger" : "btn-ghost"}`} disabled={busy}
        onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={question}>
      <span className="confirm-q">{question}</span>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy}
        onClick={() => { onConfirm(); setAsking(false); }}>
        {busy ? "Working…" : confirmLabel}
      </button>
      <button type="button" className="btn btn-text btn-sm" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}
