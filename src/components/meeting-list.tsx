"use client";

import type { Meeting } from "@/lib/client/api";

/** A small list of scheduled/cancelled meetings, with a Meet link and an optional cancel action. */
export function MeetingList({
  meetings,
  currentUserId,
  busyId,
  onCancel,
}: {
  meetings: Meeting[];
  currentUserId?: string;
  busyId: string | null;
  onCancel: (id: string) => void;
}) {
  if (meetings.length === 0) return null;

  return (
    <div className="proj-list" style={{ marginTop: 8 }}>
      {meetings.map((m) => (
        <div key={m.id} className="proj-row">
          <div className="proj-main">
            <strong>{m.title}</strong>{" "}
            <span className={`pill ${m.status === "CANCELLED" ? "p-rejected" : "p-selected"}`}>
              {m.status}
            </span>
            <p className="empty-note">
              {new Date(m.scheduledAt).toLocaleString()} · {m.durationMinutes} min · organized by {m.organizer.name}
            </p>
            {m.status === "SCHEDULED" && (
              <div className="proj-links">
                <a href={m.meetLink} target="_blank" rel="noopener noreferrer">Join Meet</a>
                {currentUserId === m.organizer.id && (
                  <button
                    type="button"
                    className="mini"
                    disabled={busyId === m.id}
                    onClick={() => onCancel(m.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
