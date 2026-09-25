/**
 * Application stages in words, for every place a person reads them: badges,
 * notifications and emails. Never show the database value itself.
 */
const LABEL: Record<string, string> = {
  APPLIED: "Applied",
  RECEIVED: "Received",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  SELECTED: "Selected",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

export function appStateLabel(state: string): string {
  return LABEL[state] ?? state;
}
