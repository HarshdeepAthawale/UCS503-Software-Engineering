/**
 * Skill-set matching (S5 groundwork; docs/PRD S5, S6).
 *
 * Jaccard similarity over skill-tag sets - named in the PRD for both
 * peer/opportunity matching (S5, not yet built) and team-role complementarity
 * (S6). Pure and dependency-free, same reasoning as application-state.ts: the
 * exact rule is unit-tested independent of any query.
 *
 * S5's explicit design principle carries over here: never show a bare score -
 * always show which tags matched and which are missing, so a result reads as
 * "matched on Python, PyTorch - missing: CUDA", not an opaque percentage.
 */

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface SkillFit {
  /** Jaccard similarity, 0..1 - a sort/sizing hint, never shown as a bare number. */
  score: number;
  /** Target skill ids the candidate already has. */
  matched: string[];
  /** Target skill ids the candidate is missing. */
  missing: string[];
}

/** How well a candidate's own skills fit a target's required/preferred tags. */
export function skillFit(
  candidateSkillIds: readonly string[],
  targetSkillIds: readonly string[],
): SkillFit {
  const candidate = new Set(candidateSkillIds);
  const target = new Set(targetSkillIds);
  const matched = [...target].filter((id) => candidate.has(id));
  const missing = [...target].filter((id) => !candidate.has(id));
  return { score: jaccard(candidate, target), matched, missing };
}
