# Design system revamp — adopting the `shreyasmahajann.vercel.app` system

Reverse-engineered from the live site on 2026-08-29 by reading its computed
styles and stylesheet rules directly, not by eye. Every value below is quoted
from the source, so this document is the specification rather than an
impression of one.

## 1. What the reference actually is

A dark-first editorial portfolio built on **three families and seven colour
tokens**. Its identity comes from an unusually small system:

- a warm near-black paper with a warm off-white ink — never neutral grey,
  never pure white
- one serif, used **only** for display, always at weight 400 with negative
  tracking
- a monospace used for *labels*, not for code — every nav item, eyebrow and
  meta line is uppercase mono at 11px
- exactly one accent, which **changes value between themes**
- a full-viewport film grain
- one signature interaction: an underline that sweeps left to right

It is close in spirit to the system this project already adopted in `d20c245`,
which is why the migration below is mostly a token swap rather than a rebuild.

## 2. Colour — the complete token set, both themes

The reference declares its palette as custom properties on
`:root[data-theme="…"]`. **This project already uses that exact mechanism**
(`globals.css` lines 82 and 114), so these drop straight in.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--paper` | `#14120f` | `#f6f2ea` | page canvas |
| `--paper-deep` | `#1d1a16` | `#efe9dd` | raised surface — cards, wells |
| `--ink` | `#f4efe6` | `#191611` | primary text |
| `--ink-soft` | `#f4efe6ad` (68%) | `#1916119e` (62%) | body copy, secondary |
| `--ink-faint` | `#f4efe66b` (42%) | `#19161161` (38%) | meta, disabled |
| `--rule` | `#f4efe62e` (18%) | `#19161129` (16%) | every hairline |
| `--accent` | `#e2694a` | `#b43a1e` | the single voltage |
| `--logo-invert` | `1` | `0` | flips a monochrome mark |

Three things are worth stating explicitly, because they are what makes it work:

1. **Secondary and faint text are the ink colour at reduced alpha**, not
   separate greys. That is why the page reads as one material: every text
   weight is literally the same pigment, thinned.
2. **The hairline is also ink, at 16–18% alpha.** There is no border colour in
   this system, only a diluted ink.
3. **The accent is not one colour.** `#e2694a` is a soft terracotta that sits
   correctly on near-black; `#b43a1e` is a deeper rust that holds contrast on
   warm paper. Using either value in both themes fails — the dark value goes
   pale on paper, the light value goes muddy on near-black.

### Decision required: this reverses an earlier choice

Commit `9cfd851` deliberately removed **all** colour accents from this project
in favour of pure monochrome. Adopting this system reintroduces one. That is
what "ditto" means here, and it is a good accent — but it is a reversal rather
than an oversight, and should be a conscious one.

## 3. Typography

Three families. Two need swapping; one is already correct.

| Slot | Reference | Currently here | Action |
|---|---|---|---|
| `--font-display` | **Fraunces** | Newsreader | swap |
| `--font-sans` | **Inter** | Plus Jakarta Sans | swap |
| `--font-mono` | **JetBrains Mono** | JetBrains Mono | **already correct** |

### The scale, as measured

| Element | Family | Size | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| `h1` | Fraunces | 60.42px | 400 | `-1.21px` (−2%) | `56.79px` (0.94) |
| `h2` | Fraunces | 24px | 400 | `-0.48px` (−2%) | `32px` (1.33) |
| `h3` | Inter | 18px | 500 | normal | `28px` |
| body `p` | Inter | 18px | 400 | normal | `29.25px` (1.625) |
| `.label` | JetBrains Mono | 11px | 400 | `0.14em` | `16.5px` |

Two rules generate all of it:

- **Display tracking is always −2% of the size.** 60.42 → −1.208; 24 → −0.48.
  One ratio, not a table of hand-picked values.
- **Display line-height tightens as size grows** — 0.94 at the hero, 1.33 at
  section headings. Body stays constant at 1.625.

The hero line-height is *below 1*, which is what makes a two-line name read as
a single block rather than two stacked lines.

## 4. Motion

Deliberately small — four behaviours in total.

```css
/* Theme change is a crossfade, not a snap. */
body { transition: background-color .35s, color .35s; }

/* The signature: an underline that grows left to right. */
.sweep {
  background-image: linear-gradient(currentcolor, currentcolor);
  background-position: 0 100%;
  background-repeat: no-repeat;
  background-size: 0% 1px;
  transition: background-size .35s cubic-bezier(.25, 1, .5, 1);
}
.sweep:hover,
a:hover > .sweep,
.group:hover .sweep { background-size: 100% 1px; }

html { scroll-behavior: smooth; }
```

Plus a scroll reveal on `[data-motion]` — 54 instances on the landing page —
fading and rising as each element enters the viewport, once.

`cubic-bezier(.25, 1, .5, 1)` is the whole feel: a fast start that decelerates
hard. It matters most on the sweep, where it is what stops the underline
reading as a linear wipe.

**Reduced motion is handled at the token level** and must be preserved:

```css
@media (prefers-reduced-motion: reduce) {
  [data-motion] { animation: none !important; transform: none !important; }
}
```

## 5. The three signature components

```css
/* Every nav item, eyebrow and meta line. Mono is a LABEL face here, not a
   code face — the single most distinctive choice on the site. */
.label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;   /* 11px */
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* Full-viewport film grain: fixed, above content, inert to pointers. An
   inline SVG feTurbulence at 3% alpha — no image request. */
.grain::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 50;
  opacity: 0.5;
  pointer-events: none;
  background-image: var(--grain);
}

::selection { background-color: var(--accent); color: var(--paper); }
```

### Decision required: grain vs. "no textures"

The dotted grid was removed from the hero on the instruction that no dot
pattern should appear anywhere. **The grain is a different thing** — fractal
noise at 3% alpha across the whole viewport, which reads as paper tooth rather
than as a visible pattern — but it is still a texture. It is included here
because "ditto" implies it; removing it is a single rule.

## 6. Layout

- Content column caps at **1152px**
- Section rhythm: `padding-bottom` of **80px** on the first, **64px** after
- Header is **72px**, `position: absolute`, fully transparent, no backdrop
  blur — it scrolls away rather than sticking

That last point departs from this project's current sticky nav and should be an
explicit decision rather than a side effect.

## 7. Implementation phases

Each phase ends compiling, typechecking and visually verified in a browser
before the next begins.

**Phase 1 — tokens.** Replace the seven colour variables in both
`:root[data-theme]` blocks and add `--grain`. This alone re-skins most of the
app, because the codebase already refers to tokens rather than to literals.

**Phase 2 — fonts.** Swap `Newsreader → Fraunces` and
`Plus_Jakarta_Sans → Inter` in `layout.tsx`; both are on Google Fonts, and
Fraunces is variable so the whole display range is one file. Re-point
`--font-display` and `--font-sans`, then apply the −2% tracking rule and the
tightened display line-heights.

**Phase 3 — labels.** Introduce `.label` and convert nav items, eyebrows and
meta lines to it. This is the change that most makes the app *look like* the
reference, and it is nearly free.

**Phase 4 — motion.** Add `.sweep` and apply it to links; add the body
transition and smooth scrolling; align the existing `reveal.tsx` with
`[data-motion]` semantics and confirm the reduced-motion path.

**Phase 5 — grain and selection.** One rule each.

**Phase 6 — surfaces.** Audit cards, wells and inputs onto `--paper-deep` and
`--rule`, removing any remaining hard-coded greys or borders.

**Phase 7 — portal and RBAC screens.** The landing page is the easy half.
Admin tables, application pipelines and role badges carry state colours this
palette does not define; they need deriving in the same warm, desaturated
register rather than borrowed from a default ramp.

## 8. What this plan does not cover

The reference is a single-page portfolio. It has no tables, no forms beyond a
contact link, no role badges, no empty states and no destructive actions.
Everything in phase 7 is genuinely new design work rather than transcription,
and should not be presented as "ditto" — there is nothing there to copy from.
