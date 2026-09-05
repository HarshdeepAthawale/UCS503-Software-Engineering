"use client";

import { useState } from "react";

/** Inline "issue attestation" form for a SELECTED applicant (T-19). */
export function AttestBar({
  skills,
  busy,
  onConfirm,
  onCancel,
}: {
  skills: { id: string; name: string }[];
  busy: boolean;
  onConfirm: (skillId: string, context: string) => void;
  onCancel: () => void;
}) {
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const [context, setContext] = useState("");

  if (skills.length === 0) {
    return (
      <div className="reject-bar" role="group" aria-label="Issue attestation">
        <span className="empty-note">This student has no listed skills to attest yet.</span>
        <button className="mini" type="button" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="reject-bar" role="group" aria-label="Issue attestation" style={{ flexWrap: "wrap" }}>
      <select
        aria-label="Skill to attest"
        value={skillId}
        disabled={busy}
        onChange={(e) => setSkillId(e.target.value)}
      >
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Engagement context"
        placeholder="e.g. NLP research assistant, Aug–Nov 2026"
        value={context}
        disabled={busy}
        onChange={(e) => setContext(e.target.value)}
        style={{ minWidth: 240 }}
      />
      <button
        className="mini solid"
        type="button"
        disabled={busy || !context.trim()}
        onClick={() => onConfirm(skillId, context.trim())}
      >
        {busy ? "Saving…" : "Confirm attestation"}
      </button>
      <button className="mini" type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
