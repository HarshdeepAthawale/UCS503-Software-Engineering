"use client";

import { useState } from "react";

/** Inline "schedule a Meet" form. Mirrors AttestBar/RejectBar's inline-bar pattern. */
export function MeetingScheduler({
  busy,
  connected,
  connectUrl,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  connected: boolean;
  connectUrl: string;
  onConfirm: (input: { title: string; scheduledAt: string; durationMinutes: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);

  if (!connected) {
    return (
      <div className="reject-bar" role="group" aria-label="Schedule a meeting" style={{ flexWrap: "wrap" }}>
        <span className="empty-note">Connect Google Calendar to schedule a Meet.</span>
        <a className="mini solid" href={connectUrl}>Connect Google Calendar</a>
        <button className="mini" type="button" onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="reject-bar" role="group" aria-label="Schedule a meeting" style={{ flexWrap: "wrap" }}>
      <input
        aria-label="Meeting title"
        placeholder="e.g. Interview"
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        style={{ minWidth: 160 }}
      />
      <input
        aria-label="Date and time"
        type="datetime-local"
        value={scheduledAt}
        disabled={busy}
        onChange={(e) => setScheduledAt(e.target.value)}
      />
      <select
        aria-label="Duration"
        value={durationMinutes}
        disabled={busy}
        onChange={(e) => setDurationMinutes(Number(e.target.value))}
      >
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={45}>45 min</option>
        <option value={60}>60 min</option>
      </select>
      <button
        className="mini solid"
        type="button"
        disabled={busy || !title.trim() || !scheduledAt}
        onClick={() =>
          onConfirm({
            title: title.trim(),
            scheduledAt: new Date(scheduledAt).toISOString(),
            durationMinutes,
          })
        }
      >
        {busy ? "Scheduling…" : "Schedule Meet"}
      </button>
      <button className="mini" type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
