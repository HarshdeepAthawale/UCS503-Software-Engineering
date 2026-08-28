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
    title: "Discover in under 2 minutes",
    body: "Full-text search and typed facets - role, domain, stipend, skill. No WhatsApp forwards, no missed noticeboards.",
  },
  {
    n: "02",
    title: "Apply - with a budget",
    body: "Hold at most ten live applications. One constraint kills spray-and-pray and caps every poster's review load.",
  },
  {
    n: "03",
    title: "Get a real answer",
    body: "Every state change is timestamped and immutable. Posters pledge an SLA; silence becomes visible, not normal.",
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
    title: "Accountable, not optional",
    body: "Time-to-Acknowledgement is computed from the event log - never self-reported. Posters carry a rolling Responsiveness Badge.",
  },
  {
    title: "Competency you can trust",
    body: "Skill attestations exist only where a Selected application connects two people. Enforced in the schema - unfarmable.",
  },
  {
    title: "Safe by design",
    body: "Messaging lives only inside an application or team - never a free-form DM. An entire class of harassment has nowhere to live.",
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
                Research roles, TA-ships, internships, referrals and hackathon
                teams - inside one verified pipeline.{" "}
                <b>Not a network. Not a feed.</b> A pipeline with
                accountability, where every application is tracked, timestamped,
                and answered.
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
              <h2>Three steps from opening to outcome.</h2>
              <p>
                Discovery that respects your time, applying with intent, and an
                answer you can rely on.
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
              <span className="eyebrow">Status legibility</span>
              <h2>Every application has one unambiguous state.</h2>
              <p>
                Colour, icon and label together - so where you stand is never a
                guess, and never a colour alone.
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
              <h2>Three guarantees a feed structurally can&apos;t make.</h2>
              <p>
                Each depends on the application record existing as a first-class
                entity.{" "}
                <Link href="/product" className="inline-link">
                  See all four →
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
                Join the pilot at Thapar Institute - find a posting in under two
                minutes, apply, and get a real answer within 48 hours.
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
