import type { Message, MessageThreadSummary } from "@/lib/client/api";

/**
 * Inbox helpers. There is no per-message read state; what the platform cares
 * about is who owes a reply, so a thread whose last message came from the
 * other person is "awaiting your reply".
 */

export function awaitingReply(t: MessageThreadSummary, myId: string | undefined): boolean {
  return !!myId && t.lastMessage.senderId !== myId;
}

/** Search by the other person's name or the posting title. */
export function threadMatches(t: MessageThreadSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return t.counterpart.name.toLowerCase().includes(q) || t.opportunity.title.toLowerCase().includes(q);
}

/** Messages split into runs by local calendar day, oldest first. */
export function groupByDay(messages: Message[]): { key: string; date: Date; messages: Message[] }[] {
  const groups: { key: string; date: Date; messages: Message[] }[] = [];
  for (const m of messages) {
    const date = new Date(m.createdAt);
    const key = date.toDateString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.messages.push(m);
    else groups.push({ key, date, messages: [m] });
  }
  return groups;
}

/** "Today", "Yesterday", or "Sat, 19 Sept". */
export function dayLabel(date: Date, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** "14:05" for message timestamps. */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
