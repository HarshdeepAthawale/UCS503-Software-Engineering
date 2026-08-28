<div align="center">

# 🎨 Landing Redesign — 3 Pages, No Dead Space

`Thapar Nexus` · Marketing site v2 · **In progress**

</div>

> Two problems observed: (1) the one long landing page had huge empty gaps —
> caused by the scroll-reveal leaving cards at `opacity:0` (now fixed: content is
> visible by default); (2) the marketing + auth pages feel sparse. This splits the
> landing into **three focused, full pages** and fills the auth screens.

---

## 1. The bug (fixed)

`.reveal` started at `opacity:0` and depended on JS adding `.in`; when the
IntersectionObserver didn't fire, every wrapped card (problem grid, comparison
table, status pills, feature grid, sample posting) stayed invisible → black gaps.
**Fix:** `.reveal` is now visible by default with a guaranteed-terminating
entrance animation — content can never be stuck hidden.

---

## 2. Three pages

A shared **`SiteNav`** (ti logo · Home · Product · About · Sign in · Get started)
and **`SiteFooter`** wrap all three.

| Route | Purpose | Sections |
|---|---|---|
| **`/`** Home | Hook + proof + funnel to sign-up | Hero (live pipeline demo) · 3-metric strip · "How it works" in 3 steps · status-legibility pills · trust/■why-us row · CTA band |
| **`/product`** | The mechanism, in depth | The 4 things a feed can't do · sample opportunity card · the application pipeline states · comparison table (feed vs Nexus) |
| **`/about`** | The thesis + the people | The 4 failures (problem framing) · the philosophy ("wants you gone, with a result") · the team · the institute · CTA |

Each page is self-contained and **full** — no empty stretches.

---

## 3. Auth pages (fill the void)

`/login` and `/register` become a **two-column split**:
- **Left** — the existing auth card (form, Google, code sign-in).
- **Right** — a branded panel: ti logo, a one-line promise, 3 concise value
  bullets, and a subtle version of the pipeline/status visual. On mobile the
  panel stacks above the form.

This removes the "lonely card on a black void" look.

---

## 4. Build order

1. ✅ Fix `.reveal` (done) · remove the hero badge (done).
2. Extract `SiteNav` + `SiteFooter` shared components.
3. Build `/product` and `/about` from the existing sections; rebuild `/` as a
   tighter, richer Home.
4. Split-layout auth pages with a branded side panel.
5. Keep `tsc` + `next build` green; verify each page has no empty gaps.

---

## 5. Design language (unchanged)

Warm-dark editorial · Fraunces / Inter / JetBrains Mono · coral→maroon accents ·
the ti lettermark · status-color tokens. Every section reads as one system.

---

<div align="center">

_Goal: three pages a visitor actually wants to scroll — and not one dead gap._

</div>
