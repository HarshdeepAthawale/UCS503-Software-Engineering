<div align="center">

# 🎨 Design System
## Thapar Nexus — Warm-Dark Editorial · Tokens & Components

`UCS503 Software Engineering` · **Document 4 of 8** · Derived from `MasterPlan.md`

<br/>

**Information density over visual delight** &nbsp;·&nbsp; **Status legibility above all** &nbsp;·&nbsp; **Zero engagement mechanics**

<br/>

_Visual language inspired by editorial dark portfolios — warm near-black canvas, cream ink,
a single warm accent, and a serif-display / sans-body pairing._

</div>

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Aesthetic Direction](#2-aesthetic-direction)
3. [Colour System](#3-colour-system)
4. [Status Palette](#4-status-palette-the-heart-of-the-system)
5. [Typography](#5-typography)
6. [Spacing, Radius & Elevation](#6-spacing-radius--elevation)
7. [Component Inventory](#7-component-inventory)
8. [Layout & Breakpoints](#8-layout--breakpoints)
9. [Accessibility Rules](#9-accessibility-rules)
10. [Light Mode Fallback](#10-light-mode-fallback)
11. [Motion](#11-motion)

---

## 1. Design Principles

The design language is **derived from the positioning**, not chosen for taste. Every rule traces back to the thesis: *a student should get in, get an answer, and get out.*

| # | Principle | In practice |
|---|---|---|
| **P1** | **Information density over visual delight** | Compact cards, tabular pipelines, no hero imagery clutter. Screens answer questions. |
| **P2** | **Status legibility above all** | Every application state has one unambiguous colour + label + icon. |
| **P3** | **Zero engagement mechanics** | No infinite scroll, no likes, no dopamine badges. Notifications are digests. |
| **P4** | **Explainability is visible** | Match results always show *why* (matched / missing tags). Never a bare score. |
| **P5** | **Accountability is legible** | Responsiveness badges and SLA states render as calm, factual numbers — never shaming. |
| **P6** | **Accessible by construction** | WCAG 2.1 AA is a build constraint. Status is never colour-only. |
| **P7** | **Editorial restraint** | Serif display + sans body, generous whitespace, borders over shadows. Premium, quiet, confident. |

---

## 2. Aesthetic Direction

Nexus is **dark-first, warm, and editorial**. The canvas is a warm near-black (never pure `#000`); ink is a warm cream (never pure `#FFF`); a single warm coral accent marks brand and action. Large headings are a **light-weight serif** with tight negative tracking; everything functional is **Inter**; numbers and IDs are **JetBrains Mono**.

| Move | Rule |
|---|---|
| **Warm near-black canvas** | Backgrounds are warm-tinted charcoal, not neutral black |
| **Cream ink** | Text is warm off-white; muted tiers use opacity, not grey mud |
| **One accent** | A single warm coral used surgically — links, focus, key CTAs, accent glows |
| **Serif display / sans body** | Fraunces (serif) for headlines; Inter for UI; JetBrains Mono for data |
| **Borders over shadows** | Density prefers hairline warm borders; shadows reserved for overlays |
| **Accent glow** | Emphasis chips sit on a 10–20% accent-tinted fill (subtle radial warmth) |

---

## 3. Colour System

### 3.1 Canvas & Ink (warm neutrals)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#0F0D0B` | App canvas — warm near-black |
| `--color-surface` | `#17140F` | Cards, panels |
| `--color-surface-alt` | `#1F1B16` | Raised panels, zebra rows, popovers |
| `--color-border` | `#2A2620` | Hairline dividers, card borders |
| `--color-border-strong` | `#3A342B` | Focused/active borders |
| `--color-text` | `#F4EFE6` | Primary ink — warm cream |
| `--color-text-muted` | `rgba(244,239,230,.68)` | Secondary text, meta |
| `--color-text-faint` | `rgba(244,239,230,.42)` | Placeholders, disabled |

```
Canvas   ▓ #0F0D0B   Surface ▓ #17140F   Alt ▓ #1F1B16   Border ▒ #2A2620
Ink      █ #F4EFE6   Muted .68            Faint .42
```

### 3.2 Accent (brand + action)

| Token | Hex | Role |
|---|---|---|
| `--color-accent` | `#E2694A` | Terracotta coral — primary interactive, links, brand |
| `--color-accent-hover` | `#EF7A5B` | Hover / lighter |
| `--color-accent-press` | `#CB583B` | Pressed |
| `--color-accent-glow` | `rgba(255,77,42,.12)` | Tinted fill behind emphasis chips |
| `--color-accent-ring` | `rgba(226,105,74,.55)` | Focus ring |
| `--color-brand-maroon` | `#7A1F2B` | Institutional tie-in — masthead footer / crest only |

> The warm accent is **brand and interaction only**. It is deliberately kept out of the status vocabulary so it never competes with `AT_RISK` amber or `REJECTED` red.

### 3.3 Semantic Feedback (tuned for the dark canvas)

| Token | Hex | Use |
|---|---|---|
| `--color-success` | `#4ADE80` | Selected, healthy SLA, verified |
| `--color-warning` | `#F5A524` | Approaching risk, pending (amber — distinct from coral) |
| `--color-danger` | `#F87171` | Rejected, SLA breach, destructive |
| `--color-info` | `#38BDF8` | Neutral informational, in-progress |

---

## 4. Status Palette (the heart of the system)

> **P2 in action.** Each application state maps to exactly one colour, one label, and one icon — lightened to sit legibly on the warm-dark canvas. Used by the **status pill** and **pipeline stepper**. This is the single most important design decision in the product.

| State | Token | Hex (dark) | Icon | Label | Meaning |
|---|---|---|---|---|---|
| `APPLIED` | `--status-applied` | `#A8A29E` warm grey | ● | Applied | Submitted, awaiting acknowledgement |
| `RECEIVED` | `--status-received` | `#38BDF8` sky | ◉ | Acknowledged | Poster has opened it (TTA captured) |
| `SHORTLISTED` | `--status-shortlisted` | `#60A5FA` blue | ▲ | Shortlisted | In active consideration |
| `INTERVIEW` | `--status-interview` | `#A78BFA` violet | ◆ | Interview | Interview stage |
| `SELECTED` | `--status-selected` | `#4ADE80` green | ✔ | Selected | Offer — terminal, unlocks attestation |
| `REJECTED` | `--status-rejected` | `#F87171` red | ✕ | Rejected | Declined with reason — terminal |
| `WITHDRAWN` | `--status-withdrawn` | `#78716C` stone | ⊘ | Withdrawn | Student withdrew — terminal |
| `EXPIRED` | `--status-expired` | `#8A8178` taupe | ⏳ | Expired | Deadline passed |
| `AT_RISK` | `--status-atrisk` | `#F5A524` amber | ⚠ | At Risk | SLA pledge breached |

```
APPLIED ●──── RECEIVED ◉──── SHORTLISTED ▲──── INTERVIEW ◆──── SELECTED ✔
 grey          sky            blue              violet           green
                                                          ╲
                                                           ╲── REJECTED ✕ (red)
                                                            ╲─ WITHDRAWN ⊘ (stone)
```

> **Rule:** status is **never** communicated by colour alone. Every pill carries colour **+ icon + text label**, so it survives colour-blindness and greyscale printing. Pills render as `color` text/icon on a `color @ 14%` tinted fill with a `color @ 30%` border.

---

## 5. Typography

An **editorial serif display + neutral sans body + mono data** stack — the pairing both reference sites use.

```css
--font-display: 'Fraunces', 'Newsreader', Georgia, 'Times New Roman', serif;
--font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
--font-feature-numeric: 'tnum' 1;   /* tabular figures for TTA / metrics */
```

- **Fraunces** (display) — large headlines only, weight **400**, optical size high, **tight tracking**. Editorial, warm, distinctive.
- **Inter** (sans) — all UI, labels, body, buttons. Excellent at small sizes.
- **JetBrains Mono** — IDs, timestamps, TTA values, metric numbers.

### 5.1 Type Scale (major-third 1.250, base 16 px)

| Token | Font | Size / Line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `--text-display` | Fraunces | 57px / 60px | 400 | −1.1px | Landing / page hero |
| `--text-h1` | Fraunces | 44px / 48px | 400 | −1.0px | Screen title |
| `--text-h2` | Fraunces | 31px / 38px | 400 | −0.6px | Section header |
| `--text-h3` | Inter | 20px / 28px | 600 | normal | Card title, opportunity title |
| `--text-body` | Inter | 16px / 24px | 400 | normal | Body copy |
| `--text-sm` | Inter | 14px / 20px | 400 | normal | Meta, secondary |
| `--text-xs` | Inter | 12px / 16px | 500 | .02em | Pills, labels, badges |
| `--text-mono` | JetBrains Mono | 13px / 20px | 500 | normal | IDs, timestamps, TTA |

> Serif is reserved for **display sizes** (≥ 31px). Never set body or dense UI in Fraunces — legibility and density both suffer.

---

## 6. Spacing, Radius & Elevation

### 6.1 Spacing (4 px base)

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-6: 24px` · `--space-8: 32px` · `--space-12: 48px` · `--space-16: 64px` · `--space-20: 80px`

> Section rhythm follows the references: **24px side gutters**, **64–80px vertical section gaps**, content capped at **~1152px**.

### 6.2 Radius (from the reference component language)

| Token | Value | Use |
|---|---|---|
| `--radius-chip` | 6px | Small chips, tags |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-full` | 9999px | Avatars, category pills, badges |

### 6.3 Elevation — borders first, glow for accent

| Token | Value | Use |
|---|---|---|
| `--elev-0` | `1px solid var(--color-border)` | Default cards (no shadow) |
| `--elev-1` | `1px solid var(--color-border-strong)` | Hover — border brightens, no lift |
| `--elev-2` | `0 8px 24px rgba(0,0,0,.45)` | Popovers, dropdowns |
| `--elev-3` | `0 20px 48px rgba(0,0,0,.6)` | Modals |
| `--glow-accent` | `0 0 0 1px var(--color-accent-glow), 0 0 32px -8px var(--color-accent-glow)` | Emphasis chips / featured cards |

---

## 7. Component Inventory

### 7.1 Opportunity Card

```
┌────────────────────────────────────────────────────────┐
│  ⬤ RESEARCH · Machine Learning          ⏳ 4 days left  │
│                                                        │
│  NLP Research Assistant            ← Inter 20/600      │
│  Dr. A. Rao · CSED    [🟢 Responsive · 18h median TTA] │
│  ────────────────────────────────────────────────────  │
│  Required  [Python] [PyTorch] [NLP]   Preferred [CUDA] │
│  2 seats · Stipend · Aug–Nov 2026                      │
│                                    [ View ]  [ Save ]   │
└────────────────────────────────────────────────────────┘
   surface #17140F · border #2A2620 · radius 12px
```

| Element | Spec |
|---|---|
| Type chip | `--text-xs`, uppercase, accent-tinted (`--color-accent-glow` bg) |
| Deadline | Text + icon; shifts amber < 72h, red < 24h (never colour-only) |
| Responsiveness badge | Green/amber/red dot + median TTA number |
| Skill tags | Required (solid warm fill) vs Preferred (outline); attested variant has ✔ |
| Hover | `--elev-0` → `--elev-1` (border brightens); featured cards use `--glow-accent` |

### 7.2 Status Pill

```
[● Applied]  [◉ Acknowledged]  [▲ Shortlisted]  [✔ Selected]  [✕ Rejected]
```
Colour + icon + label from §4. `--text-xs`, `--radius-full`, tinted fill `color @14%`, border `color @30%`, padding `2px 10px`.

### 7.3 Pipeline Stepper

```
 ●━━━━━◉━━━━━▲━━━━━◆━━━━━◇
Applied  Ack  Short  Intv  Selected
 ✓       ✓    ✓     ●     ○
        18h TTA (mono, muted)
```

| Rule | Detail |
|---|---|
| Completed | Filled + check in state colour |
| Current | Accent-ring pulse (motion-safe) |
| Future | Hollow, `--color-text-faint` |
| Connector | `--color-border` track; filled portion in state colour |
| ARIA | `role="list"`, `aria-current="step"`, per-step state announced |

### 7.4 Skill Tag — self-claimed vs attested

```
Self-claimed:  [ PyTorch · Intermediate ]        outline, muted border
Attested:      [ ✔ PyTorch · NLP RA, Aug–Nov ]   solid, success-tinted, verified ✔
```
Attested tags **rank above** self-claimed everywhere and carry the context string in a tooltip.

### 7.5 Responsiveness Badge

```
🟢 Responsive     median TTA 18h · 92% response
🟡 Moderate       median TTA 40h · 74% response
🔴 Slow           median TTA 5d  · 41% response
```
A **number, never a review.** Band derived from median TTA vs the SLA pledge.

### 7.6 Buttons (reference-style)

| Variant | Style |
|---|---|
| Primary | Accent fill `--color-accent`, cream text, `--radius-md`, `0 16px` padding |
| Secondary | Translucent `--color-surface-alt`, `--color-border` border, cream text |
| Ghost | Transparent, muted text → accent on hover |
| Danger | `--color-danger` text, danger-tinted border |

All buttons: min height **40px**, target ≥ **44px**, focus ring `--color-accent-ring`.

### 7.7 Category Chip (accent glow)

```
[ Executive ]   accent-glow bg + accent border   ← active
[ Technical ]   transparent + muted text          ← inactive
```
Borrowed directly from CyberHound's segmented chips — used for view toggles (e.g. applicant filters).

### 7.8 Filter Panel · Empty State · Notification Row

- **Filter panel:** left rail (desktop) / bottom sheet (mobile). Facets: Type · Domain · Skill tags · Stipend · Duration · Deadline. Active filters as removable chips.
- **Empty state:** serif headline + one-line explanation + one primary action (see `AppFlow.md` §8).
- **Notification row:** category icon · digest summary · timestamp (mono) · optional single action. Batched, never per-event.

### 7.9 Component Summary

| Component | States | Key a11y |
|---|---|---|
| Opportunity card | default, hover, saved, expired, featured | Focusable, `aria-label` w/ title+deadline |
| Status pill | 9 states (§4) | Colour + icon + text |
| Pipeline stepper | past / current / future | `aria-current`, list semantics |
| Skill tag | self-claimed, attested | Verified marker announced |
| Responsiveness badge | green / amber / red | Text value, not colour-only |
| Button | primary / secondary / ghost / danger | 44px target, accent focus ring |
| Category chip | active / inactive | `aria-pressed` |
| Filter panel | open / collapsed | Keyboard operable, labelled groups |

---

## 8. Layout & Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `sm` | < 640px | Single column; filters in bottom sheet; stepper vertical |
| `md` | 640–1024px | Two columns; collapsible filter rail |
| `lg` | 1024–1440px | Three-zone: filter rail · results · detail preview |
| `xl` | > 1440px | Content capped **1152px**, centred; generous gutters |

Grid: 12-column, `--space-6` gutters. Content max-width **1152px** (matching the references). Density target: an opportunity list shows **≥ 6 cards** above the fold on a laptop.

---

## 9. Accessibility Rules

| Rule | Requirement |
|---|---|
| **Contrast** | Cream `#F4EFE6` on canvas `#0F0D0B` ≈ **15:1**. Body ≥ 4.5:1; UI/large ≥ 3:1. Status hues lightened specifically to pass on the dark canvas *and* their tint fill. |
| **Accent caution** | Coral `#E2694A` on dark passes for **large text, icons, borders, and fills** — avoid it for small body text; use cream instead. |
| **Never colour-only** | Every status carries icon + text (§4). |
| **Focus order** | Logical DOM order; visible ring (`2px` `--color-accent-ring`, `2px` offset). |
| **Keyboard nav** | All flows — search, apply, transition, attest — fully keyboard operable. Skip-to-content link. |
| **ARIA on stepper** | `role="list"`, `aria-current="step"`, per-step state announced. |
| **Targets** | Interactive targets ≥ **44 × 44px**. |
| **Forms** | Every input labelled; errors linked via `aria-describedby`; Zod messages inline. |
| **Motion** | Respect `prefers-reduced-motion`; stepper pulse and glows become static. |

---

## 10. Light Mode Fallback

The product is **dark-first**. A light theme is offered for printing and preference; it swaps *roles* while keeping status hues recognisable (darkened for contrast on light surfaces).

| Token | Dark (default) | Light |
|---|---|---|
| `--color-bg` | `#0F0D0B` | `#FBF9F4` (warm paper) |
| `--color-surface` | `#17140F` | `#FFFFFF` |
| `--color-surface-alt` | `#1F1B16` | `#F3EEE4` |
| `--color-border` | `#2A2620` | `#E7E0D2` |
| `--color-text` | `#F4EFE6` | `#1A1712` |
| `--color-text-muted` | `rgba(244,239,230,.68)` | `#5B5346` |
| `--color-accent` | `#E2694A` | `#C6512F` (darkened for AA on paper) |
| `--status-selected` | `#4ADE80` | `#15803D` |
| `--status-rejected` | `#F87171` | `#B91C1C` |
| `--status-atrisk` | `#F5A524` | `#B45309` |

Implementation: define the **dark** palette on `:root`; redefine tokens under `[data-theme="light"]` and `@media (prefers-color-scheme: light)`. Never define a colour only inside one theme block. Give `body` an explicit token background.

---

## 11. Motion

| Interaction | Motion | Duration |
|---|---|---|
| Card hover | Border brightens (`--elev-0` → `--elev-1`) | 120ms ease-out |
| Featured card | Accent glow fades in | 180ms |
| Status transition | Pill cross-fades to new colour | 180ms |
| Stepper advance | Fill sweep + check | 240ms |
| Toast/digest | Slide-in from top-right | 200ms |
| Modal | Fade + 8px rise | 180ms |

All motion honours `prefers-reduced-motion: reduce` → transitions collapse to instant; glows render static.

---

<div align="center">

[← AppFlow](AppFlow.md) &nbsp;·&nbsp; **Design** &nbsp;·&nbsp; [Schema →](Schema.md)

_Warm-dark, editorial, status-first — premium and quiet, never a dopamine machine._
_Inspired by `shreyasmahajann.vercel.app` and `cyberhound.ai`; adapted to Nexus's status system._

</div>
