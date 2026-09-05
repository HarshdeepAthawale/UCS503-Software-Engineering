# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`plan.md`** at the repo root when the work is a course-shaped change (SRS, UML, testing levels, SCM).
- **`docs/adr/`**: ADRs written after the agent harness landed. Historical trade-offs already recorded in `docs/Tracker.md` §9 (D-01…D-28) still count: if you are about to contradict one, surface it.
- Course SRS (`docs/PRD.md`, `docs/Schema.md`, `docs/AppFlow.md`) when the work is a requirements or state-machine change, not for everyday naming.

If an ADR folder is empty, **proceed silently**. `/domain-modeling` (via `/grill-with-docs`) creates ADRs when a decision is hard to reverse, surprising, and a real trade-off.

## File structure

Single-context:

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   ├── agents/
│   └── Tracker.md          ← historical decision log (D-nn)
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR or a Tracker D-nn row, surface it explicitly rather than silently overriding:

> _Contradicts D-28 (split deploy / same-origin rewrite), but worth reopening because…_
