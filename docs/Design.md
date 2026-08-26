<div align="center">

# 🎨 Design System
## Thapar Nexus — Visual Language, Tokens & Components

`UCS503 Software Engineering` · **Document 4 of 8** · Derived from `MasterPlan.md`

<br/>

**Information density over visual delight** &nbsp;·&nbsp; **Status legibility above all** &nbsp;·&nbsp; **Zero engagement mechanics**

</div>

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Colour System](#2-colour-system)
3. [Status Palette](#3-status-palette-the-heart-of-the-system)
4. [Typography](#4-typography)
5. [Spacing, Radius & Elevation](#5-spacing-radius--elevation)
6. [Component Inventory](#6-component-inventory)
7. [Layout & Breakpoints](#7-layout--breakpoints)
8. [Accessibility Rules](#8-accessibility-rules)
9. [Dark Mode](#9-dark-mode-token-mapping)
10. [Motion](#10-motion)

---

## 1. Design Principles

The design language is **derived from the positioning**, not chosen for taste. Every rule below traces back to the thesis: *a student should get in, get an answer, and get out.*

| # | Principle | What it means in practice |
|---|---|---|
| **P1** | **Information density over visual delight** | Compact cards, tabular pipelines, no hero imagery. Screens answer questions; they don't entertain. |
| **P2** | **Status legibility above all** | Every application state has *one* unambiguous colour + label + icon. A user reads status in under a second. |
| **P3** | **Zero engagement mechanics** | No infinite scroll, no like buttons, no red-dot dopamine badges beyond actionable counts. Notifications are digests. |
| **P4** | **Explainability is visible** | Match results always show *why* (matched / missing tags). Never a bare score. |
| **P5** | **Accountability is legible** | Responsiveness badges and SLA states render as calm, factual numbers — never as shaming. |
| **P6** | **Accessible by construction** | WCAG 2.1 AA is a build constraint, not a review checkbox. Status is never colour-only. |

---

## 2. Colour System

### 2.1 Brand & Neutrals

The palette is **institutional and restrained** — Thapar maroon as an anchor, cool slate neutrals for density, and a single blue action colour so the eye always knows what is clickable.

| Token | Hex | Role |
|---|---|---|
| `--color-brand` | `#7A1F2B` | Thapar maroon — masthead, primary brand accents |
| `--color-brand-tint` | `#A83A48` | Hover / lighter brand |
| `--color-action` | `#2563EB` | Primary interactive (buttons, links, focus) |
| `--color-action-hover` | `#1D4ED8` | Action hover |
| `--color-bg` | `#F8FAFC` | App background (light) |
| `--color-surface` | `#FFFFFF` | Cards, panels |
| `--color-surface-alt` | `#F1F5F9` | Zebra rows, subtle fills |
| `--color-border` | `#E2E8F0` | Dividers, card borders |
| `--color-text` | `#0F172A` | Primary text |
| `--color-text-muted` | `#475569` | Secondary text, meta |
| `--color-text-faint` | `#94A3B8` | Placeholders, disabled |

```
Brand ramp     ▓▓▓ #7A1F2B  ▓▓▓ #A83A48
Action ramp    ▓▓▓ #1D4ED8  ▓▓▓ #2563EB  ░░░ #DBEAFE
Neutral ramp   #0F172A ─ #475569 ─ #94A3B8 ─ #E2E8F0 ─ #F1F5F9 ─ #F8FAFC ─ #FFFFFF
```

### 2.2 Semantic Feedback

| Token | Hex | Use |
|---|---|---|
| `--color-success` | `#16A34A` | Selected, healthy SLA, verified |
| `--color-warning` | `#D97706` | At-risk approaching, pending |
| `--color-danger` | `#DC2626` | Rejected, SLA breach, destructive |
| `--color-info` | `#0891B2` | Neutral informational, in-progress |

---

## 3. Status Palette (the heart of the system)

> **P2 in action.** Each application state maps to exactly one colour, one label, and one icon. This mapping is used by the **status pill** and the **pipeline stepper** and is the single most important design decision in the product.

| State | Token | Hex | Icon | Label | Meaning |
|---|---|---|---|---|---|
| `APPLIED` | `--status-applied` | `#64748B` slate | ● | Applied | Submitted, awaiting acknowledgement |
| `RECEIVED` | `--status-received` | `#0891B2` cyan | ◉ | Acknowledged | Poster has opened it (TTA captured) |
| `SHORTLISTED` | `--status-shortlisted` | `#2563EB` blue | ▲ | Shortlisted | In active consideration |
| `INTERVIEW` | `--status-interview` | `#7C3AED` violet | ◆ | Interview | Interview stage |
| `SELECTED` | `--status-selected` | `#16A34A` green | ✔ | Selected | Offer — terminal, unlocks attestation |
| `REJECTED` | `--status-rejected` | `#DC2626` red | ✕ | Rejected | Declined with reason — terminal |
| `WITHDRAWN` | `--status-withdrawn` | `#94A3B8` grey | ⊘ | Withdrawn | Student withdrew — terminal |
| `EXPIRED` | `--status-expired` | `#78716C` stone | ⏳ | Expired | Deadline passed |
| `AT_RISK` | `--status-atrisk` | `#D97706` amber | ⚠ | At Risk | SLA pledge breached |

```
APPLIED ●──── RECEIVED ◉──── SHORTLISTED ▲──── INTERVIEW ◆──── SELECTED ✔
 slate         cyan            blue              violet           green
                                                          ╲
                                                           ╲── REJECTED ✕ (red)
                                                            ╲─ WITHDRAWN ⊘ (grey)
```

> **Rule:** status is **never** communicated by colour alone. Every pill carries colour **+ icon + text label** so it survives colour-blindness and greyscale printing.

---

## 4. Typography

Density demands a compact, legible pairing. **Inter** for UI (excellent at small sizes, tabular figures for numbers), **JetBrains Mono** for IDs, timestamps, and TTA values.

```css
--font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
--font-feature-numeric: 'tnum' 1, 'cv05' 1;  /* tabular numbers for TTA/metrics */
```

### 4.1 Type Scale (1.250 major-third, base 16 px)

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `--text-display` | 39px / 44px | 700 | Page hero (rare) |
| `--text-h1` | 31px / 38px | 700 | Screen title |
| `--text-h2` | 25px / 32px | 600 | Section header |
| `--text-h3` | 20px / 28px | 600 | Card title, opportunity title |
| `--text-body` | 16px / 24px | 400 | Body copy |
| `--text-sm` | 14px / 20px | 400 | Meta, secondary |
| `--text-xs` | 12px / 16px | 500 | Pills, labels, badges |
| `--text-mono` | 13px / 20px | 500 | IDs, timestamps, TTA |

---

## 5. Spacing, Radius & Elevation

### 5.1 Spacing (4 px base)

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-6: 24px` · `--space-8: 32px` · `--space-12: 48px`

### 5.2 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Pills, tags |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-full` | 9999px | Avatars, badges |

### 5.3 Elevation (restrained — density prefers borders to shadows)

| Token | Shadow | Use |
|---|---|---|
| `--elev-0` | none, `1px` border | Default cards |
| `--elev-1` | `0 1px 2px rgba(15,23,42,.06)` | Hover cards |
| `--elev-2` | `0 4px 12px rgba(15,23,42,.10)` | Popovers, dropdowns |
| `--elev-3` | `0 12px 32px rgba(15,23,42,.16)` | Modals |

---

## 6. Component Inventory

### 6.1 Opportunity Card

```
┌────────────────────────────────────────────────────────┐
│ ⬤ RESEARCH · Machine Learning          ⏳ 4 days left   │
│ NLP Research Assistant                                 │
│ Dr. A. Rao · CSED     [🟢 Responsive · 18h median TTA] │
│ ─────────────────────────────────────────────────────  │
│ Required  [Python] [PyTorch] [NLP]   Preferred [CUDA]  │
│ 2 seats · Stipend · Aug–Nov 2026                       │
│                                    [ View ]  [ Save ]   │
└────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Type chip | `--text-xs`, uppercase, brand-tinted |
| Deadline | Colour shifts amber < 72h, red < 24h; always paired with text |
| Responsiveness badge | Green/amber/red dot + median TTA number |
| Skill tags | Required (solid) vs Preferred (outline); attested variant has ✔ |
| Radius | `--radius-lg`, `--elev-0` → `--elev-1` on hover |

### 6.2 Status Pill

```
[● Applied]  [◉ Acknowledged]  [▲ Shortlisted]  [✔ Selected]  [✕ Rejected]
```
Colour + icon + label from §3. `--text-xs`, `--radius-full`, padding `2px 8px`, `--space-1` icon gap.

### 6.3 Pipeline Stepper

```
 ●━━━━━◉━━━━━▲━━━━━◆━━━━━◇
Applied  Ack  Short  Intv  Selected
 ✓       ✓    ✓     ●     ○
  18h TTA
```

| Rule | Detail |
|---|---|
| Completed steps | Filled + check, state colour |
| Current step | Pulsing ring (motion-safe), state colour |
| Future steps | Hollow, `--color-text-faint` |
| TTA annotation | Mono, under the RECEIVED node |
| ARIA | `role="list"`, each step `aria-current="step"` where active; `aria-label` states the state name |

### 6.4 Skill Tag — self-claimed vs attested

```
Self-claimed:  [ PyTorch · Intermediate ]        (outline, neutral)
Attested:      [ ✔ PyTorch · NLP RA, Aug–Nov ]   (solid green, verified marker)
```
Attested tags **rank above** self-claimed in all listings and carry the context string in a tooltip.

### 6.5 Responsiveness Badge

```
🟢 Responsive     median TTA 18h · 92% response
🟡 Moderate       median TTA 40h · 74% response
🔴 Slow           median TTA 5d  · 41% response
```
A **number, never a review, never a comment.** Colour band is derived from median TTA vs the SLA pledge.

### 6.6 Filter Panel

Left rail (desktop) / bottom sheet (mobile). Facets: Type · Domain · Skill tags (multi) · Stipend · Duration · Deadline window. Sort: Deadline / Recency / Match. Active filters shown as removable chips above results.

### 6.7 Empty State & Notification Row

- **Empty state:** centred icon, one-line explanation, one primary action (see `AppFlow.md` §8).
- **Notification row:** category icon · digest summary · timestamp (mono) · optional single action. Batched, never per-event spam.

### 6.8 Component Summary

| Component | States | Key a11y |
|---|---|---|
| Opportunity card | default, hover, saved, expired | Focusable, `aria-label` w/ title+deadline |
| Status pill | 9 states (§3) | Colour + icon + text |
| Pipeline stepper | past / current / future | `aria-current`, list semantics |
| Skill tag | self-claimed, attested | Verified marker announced |
| Responsiveness badge | green / amber / red | Text value, not colour-only |
| Filter panel | open / collapsed | Keyboard operable, labelled groups |
| Button | primary / secondary / ghost / danger | 44px min target, focus ring |
| Empty state | per screen | Meaningful heading |

---

## 7. Layout & Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `sm` | < 640px | Single column; filters in bottom sheet; stepper vertical |
| `md` | 640–1024px | Two columns; collapsible filter rail |
| `lg` | 1024–1440px | Three-zone: filter rail · results · detail preview |
| `xl` | > 1440px | Max content width 1280px, centred; generous gutters |

Grid: 12-column, `--space-6` gutters. Content max-width `1280px`. Density target: an opportunity list shows **≥ 6 cards** above the fold on a laptop.

---

## 8. Accessibility Rules

| Rule | Requirement |
|---|---|
| **Contrast** | Body text ≥ **4.5:1**; large text & UI components ≥ **3:1**. Status colours chosen to pass on white *and* their tint background. |
| **Never colour-only** | Every status carries icon + text (§3). |
| **Focus order** | Logical DOM order; visible focus ring (`2px` `--color-action`, `2px` offset). |
| **Keyboard nav** | All flows — search, apply, transition, attest — fully keyboard operable. Skip-to-content link. |
| **ARIA on stepper** | `role="list"`, `aria-current="step"`, per-step state announced. |
| **Targets** | Interactive targets ≥ **44 × 44px**. |
| **Forms** | Every input labelled; errors linked via `aria-describedby`; Zod messages surfaced inline. |
| **Motion** | Respect `prefers-reduced-motion`; stepper pulse becomes static. |

---

## 9. Dark Mode (token mapping)

Dark mode swaps the *roles*, keeping status hues recognisable (slightly lightened for contrast on dark surfaces).

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#F8FAFC` | `#0B1220` |
| `--color-surface` | `#FFFFFF` | `#111A2E` |
| `--color-surface-alt` | `#F1F5F9` | `#1A2438` |
| `--color-border` | `#E2E8F0` | `#26324A` |
| `--color-text` | `#0F172A` | `#E6EDF7` |
| `--color-text-muted` | `#475569` | `#9FB0C7` |
| `--color-action` | `#2563EB` | `#60A5FA` |
| `--status-selected` | `#16A34A` | `#22C55E` |
| `--status-rejected` | `#DC2626` | `#F87171` |
| `--status-atrisk` | `#D97706` | `#FBBF24` |

Implementation: define the light palette on `:root`, redefine tokens under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. Never define a colour only inside a dark block.

---

## 10. Motion

| Interaction | Motion | Duration |
|---|---|---|
| Card hover | `--elev-0` → `--elev-1`, 2px lift | 120ms ease-out |
| Status transition | Pill cross-fades to new colour | 180ms |
| Stepper advance | Fill sweep + check | 240ms |
| Toast/digest | Slide-in from top-right | 200ms |
| Modal | Fade + 8px rise | 180ms |

All motion honours `prefers-reduced-motion: reduce` → transitions collapse to instant.

---

<div align="center">

[← AppFlow](AppFlow.md) &nbsp;·&nbsp; **Design** &nbsp;·&nbsp; [Schema →](Schema.md)

_The palette encodes the product: calm, factual, status-first — never a dopamine machine._

</div>
