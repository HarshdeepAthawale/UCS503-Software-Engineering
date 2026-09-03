import Link from "next/link";
import PipelineDemo from "@/components/pipeline-demo";
import Reveal from "@/components/reveal";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * Home - page 1 of the three-page landing. Hook, proof, how-it-works, and a
 * funnel to sign-up. Content is visible by default (no fragile scroll-reveal).
 */

const STEPS = [
  {
    n: "01",
    title: "Find an opportunity",
    body: "Search research roles, internships, TA positions and more - all in one place, not scattered across group chats.",
  },
  {
    n: "02",
    title: "Apply in a few clicks",
    body: "No emails, no forms. Apply directly and watch your application move through each stage.",
  },
  {
    n: "03",
    title: "Get a real answer",
    body: "Every poster promises a response time. If they go quiet, it shows - so you're never left wondering.",
  },
];

const PILLS = [
  ["●", "Applied", "p-applied"],
  ["◉", "Acknowledged", "p-received"],
  ["▲", "Shortlisted", "p-shortlisted"],
  ["◆", "Interview", "p-interview"],
  ["✔", "Selected", "p-selected"],
  ["✕", "Rejected", "p-rejected"],
  ["⊘", "Withdrawn", "p-withdrawn"],
  ["⚠", "At Risk", "p-atrisk"],
] as const;

const HIGHLIGHTS = [
  {
    title: "No more ghosting",
    body: "We track exactly how long a poster takes to reply. Slow responders can't hide it - it's right there on their profile.",
  },
  {
    title: "Skills you can trust",
    body: "A skill only gets verified after real work together, not as a favour between friends.",
  },
  {
    title: "No random DMs",
    body: "Messaging only happens inside a real application. No cold messages, no spam, no harassment.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="top">
        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap hero-grid">
            <div>
              {/* No hard <br>. They were chosen for one viewport width and
                  fought the responsive clamp: at the 64px maximum the longest
                  intended line needs about 780px in a 550px column, so each of
                  the three "lines" wrapped again and left "Make sure" stranded
                  on a line of its own - three intended lines rendering as five.
                  `text-wrap: balance` (set on h1 in globals.css) distributes
                  the words evenly at whatever width the column happens to be,
                  which is the only version that is correct at every size. The
                  spans keep the accent and the fade. */}
              <h1>
                <span className="hero-line">Make sure an application</span>
                <span className="hero-line grad-text">reaches a decision.</span>
                <span className="hero-line fade">
                  And make it visible when it doesn&apos;t.
                </span>
              </h1>
              <p className="lede">
                Right now, opportunities get shared in WhatsApp groups and
                emails go unanswered. <b>Nexus fixes that.</b> Post or find an
                opportunity, apply, and track exactly where you stand - until
                you get a real answer.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/register">
                  Explore opportunities →
                </Link>
                <Link className="btn btn-ghost" href="/product">
                  See how it works
                </Link>
              </div>
            </div>
            <PipelineDemo />
          </div>

          {/* The three proof stats sit BELOW the two-column grid, not inside the
              left one. Two things were wrong while they lived in the column:
              the column became tall enough (headline + lede + actions + stats)
              that `align-items: center` parked the demo card down beside the
              lede instead of beside the headline, and the stats themselves had
              only ~550px to work with, so they wrapped 2-then-1 and left a hole
              under the card. Full width fixes both at once - the column shrinks
              so the card centres on the headline, and the stats run three
              across as one band. */}
          <div className="wrap">
            <div className="hero-meta">
              <div className="stat">
                <div className="n mono">≤48h</div>
                <div className="l">Median acknowledgement</div>
              </div>
              <div className="stat">
                <div className="n mono">&lt;2min</div>
                <div className="l">To a relevant posting</div>
              </div>
              <div className="stat">
                <div className="n mono">100%</div>
                <div className="l">Timestamped, immutable</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">How it works</span>
              <h2>Three steps. That's it.</h2>
              <p>
                Find something worth applying to, apply, and actually hear back.
              </p>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <Reveal key={s.n} className="step">
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATUS LEGIBILITY ── */}
        <section id="status">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Track your status</span>
              <h2>Always know exactly where you stand.</h2>
              <p>
                Applied, Shortlisted, Interview, Selected or Rejected - your
                application always shows its real, current stage. No guessing.
              </p>
            </div>
            <Reveal className="pillwrap">
              {PILLS.map(([g, label, cls]) => (
                <span key={label} className={`pill ${cls}`}>
                  <span className="g">{g}</span> {label}
                </span>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ── HIGHLIGHTS ── */}
        <section id="why">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Why Nexus</span>
              <h2>What a WhatsApp group can&apos;t do.</h2>
              <p>
                A few things only possible when every application is tracked
                properly.{" "}
                <Link href="/product" className="inline-link">
                  See everything →
                </Link>
              </p>
            </div>
            <div className="steps">
              {HIGHLIGHTS.map((h) => (
                <Reveal key={h.title} className="step accentcard">
                  <h3>{h.title}</h3>
                  <p>{h.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="cta">
          <div className="wrap">
            <Reveal className="cta-band">
              <h2>Apply once. Always know where you stand.</h2>
              <p>
                Join the pilot at Thapar Institute - find a posting in minutes,
                apply, and get a real answer.
              </p>
              <div className="cta-actions">
                <Link className="btn btn-primary" href="/register">
                  Create your profile
                </Link>
                <Link className="btn btn-ghost" href="/about">
                  Read the thesis
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
