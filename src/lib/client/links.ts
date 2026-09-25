/**
 * A link as the user typed it, ready to save: trimmed, empty becomes null, and
 * a bare "github.com/you" gets https:// in front - people rarely type the
 * scheme. Anything that already has a scheme (including a dangerous one like
 * `javascript:`) is left alone for the server to accept or refuse.
 */
export function normalizeLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return `https://${v}`;
}
