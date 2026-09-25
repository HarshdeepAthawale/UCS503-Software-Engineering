import type { AdminOverview } from "@/lib/client/api";

export type AdminTab = "overview" | "flags" | "users" | "faculty" | "alumni" | "admins";

const TABS: { value: AdminTab; label: string; superOnly?: boolean }[] = [
  { value: "overview", label: "Overview" },
  { value: "flags", label: "Flags" },
  { value: "users", label: "Users" },
  { value: "faculty", label: "Faculty roster" },
  { value: "alumni", label: "Alumni" },
  { value: "admins", label: "Admins", superOnly: true },
];

/** The console's tabs. Admins is the super admin's alone (the API enforces it). */
export function adminTabs(isSuper: boolean): { value: AdminTab; label: string }[] {
  return TABS.filter((t) => isSuper || !t.superOnly);
}

/** The tab named in the URL, or the overview if it is unknown or not allowed. */
export function parseAdminTab(raw: string | null, isSuper: boolean): AdminTab {
  return adminTabs(isSuper).find((t) => t.value === raw)?.value ?? "overview";
}

export interface AttentionItem {
  key: "flags" | "atRisk" | "claims";
  count: number;
  label: string;
  /** Where to act on it, when there is a place in the console. */
  tab?: AdminTab;
}

/** What needs an admin now, most urgent first. Empty when nothing does. */
export function attentionItems(o: AdminOverview): AttentionItem[] {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const items: AttentionItem[] = [
    { key: "flags", count: o.openFlags, label: plural(o.openFlags, "posting flag to review", "posting flags to review"), tab: "flags" },
    {
      key: "atRisk",
      count: o.opportunities.atRisk,
      label: plural(o.opportunities.atRisk, "posting at risk of going silent", "postings at risk of going silent"),
    },
    { key: "claims", count: o.pendingClaims, label: plural(o.pendingClaims, "alumni claim awaiting review", "alumni claims awaiting review") },
  ];
  return items.filter((i) => i.count > 0);
}
