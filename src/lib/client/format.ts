/** Small presentation helpers shared across the app screens. */

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const OPP_TYPE_LABEL: Record<string, string> = {
  RESEARCH: "Research",
  INTERNSHIP: "Internship",
  TA: "Teaching Assistant",
  HACKATHON_TEAM: "Hackathon Team",
  MICRO_TASK: "Micro-task",
  REFERRAL: "Referral",
};
export function oppTypeLabel(t: string): string {
  return OPP_TYPE_LABEL[t] ?? titleCase(t);
}

const BADGE_LABEL: Record<string, string> = {
  HIGHLY_RESPONSIVE: "Highly responsive",
  RESPONSIVE: "Responsive",
  SLOW: "Slow to respond",
  UNRESPONSIVE: "Unresponsive",
  NEW: "New poster",
};
export function badgeLabel(b: string): string {
  return BADGE_LABEL[b] ?? titleCase(b);
}

const SLA_LABEL: Record<string, string> = {
  H24: "24-hour reply",
  H48: "48-hour reply",
  WEEK: "1-week reply",
};
export function slaLabel(s: string): string {
  return SLA_LABEL[s] ?? s;
}

/** Modifier class for a `.pill`, e.g. "p-selected" / "p-atrisk". */
export function statusClass(state: string): string {
  return `p-${state.toLowerCase().replace(/_/g, "")}`;
}

/** "in 3 days", "in 5 hours", "today", or "closed" for a deadline. */
export function deadlineLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return "closing soon";
}

/**
 * The complete "Closes …" line for a deadline, past or future. `deadlineLabel`
 * returns the bare word "closed" once the deadline has passed, so a caller
 * that always prepends "Closes " renders "Closes closed" - this returns the
 * whole sentence instead so there's only one place that can get it wrong.
 */
export function closesLabel(iso: string): string {
  const label = deadlineLabel(iso);
  return label === "closed" ? "Closed" : `Closes ${label}`;
}

/** "just now", "3h ago", "2d ago", or a date for older items. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ttaLabel(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: "STRONGER_APPLICANTS", label: "Stronger applicants" },
  { value: "SKILL_MISMATCH", label: "Skill mismatch" },
  { value: "SEATS_FILLED", label: "Seats filled" },
  { value: "TIMING_CONFLICT", label: "Timing conflict" },
  { value: "PROFILE_INCOMPLETE", label: "Profile incomplete" },
  { value: "OTHER", label: "Other" },
];
