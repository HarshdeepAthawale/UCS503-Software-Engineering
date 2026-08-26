import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import PipelineDemo from "@/components/pipeline-demo";
import Reveal from "@/components/reveal";

/**
 * Thapar Nexus landing page — port of the approved warm-dark editorial artifact
 * (claude.ai/code/artifact/25ed0a0f) into the Next.js app. Fully themed
 * (dark-first, light fallback + toggle), status-legible, reduced-motion safe.
 */

const PROBLEMS = [
  {
    tag: "F1 · Discovery",
    title: "Postings are missed",
    body: "Circulation is channel-dependent. Not in the right group? You never see the opening.",
    muted: true,
  },
  {
    tag: "F2 · Authenticity",
    title: "Details drift",
    body: "Forwarded messages lose provenance. Deadlines mutate; nobody can confirm who posted.",
    muted: true,
  },
  {
    tag: "F4 · Competency",
    title: "Every skill is self-claimed",
    body: "A poster has no way to verify a claimed skill maps to real work.",
    muted: true,
  },
];

const SPLIT = [
  ["Atomic unit", "A post", "An opportunity + application"],
  ["Success metric", "Engagement, time-on-app", "Time-to-Acknowledgement, decision rate"],
  ["Content lifetime", "Permanent, accumulating", "Deadline-bound, auto-expiring"],
  ["Who holds power", "The most-followed", "The most-responsive"],
  ["Optimal behaviour", "Use it more", "Use it less, get a result faster"],
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

const FEATURES = [
  {
    num: "01",
    title: "Ghosting, made accountable",
    body: "Time-to-Acknowledgement is computed from immutable database timestamps — never self-reported. Posters carry a rolling Responsiveness Badge and pledge an SLA; breaches are flagged, not hidden.",
    tags: ["Immutable event log", "SLA pledge"],
  },
  {
    num: "02",
    title: "Attestations anchored to real work",
    body: "A skill endorsement can only exist where a completed, Selected application connects the two people. Enforced in the schema — so competency can't be farmed or traded between friends.",
    tags: ["✔ PyTorch · NLP RA", "Verified"],
    attested: true,
  },
  {
    num: "03",
    title: "An application budget",
    body: "Hold at most ten live applications at once. One constraint stops spray-and-pray applying and caps every poster's review load — the two-sided load control a feed has no reason to build.",
    tags: ["10 active slots", "Withdraw frees one"],
  },
  {
    num: "04",
    title: "Messaging that can't float free",
    body: "A thread exists only inside an application or a team — never a free-form DM. Safety by design: an entire class of harassment simply has nowhere to live.",
    tags: ["Scoped threads", "Explainable matching"],
  },
];

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top">
            <span className="mark">N</span> Thapar&nbsp;Nexus
          </a>
          <nav className="nav-links">
            <a href="#problem">The problem</a>
            <a href="#difference">Why different</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#features">Features</a>
          </nav>
          <div className="nav-cta">
            <ThemeToggle />
            <Link className="btn btn-primary" href="/register">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── HERO ── */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Thapar Institute · Opportunity Pipeline</span>
              <h1>
                Make sure an application
                <br />
                reaches a decision.
                <br />
                <span className="fade">And make it visible when it doesn&apos;t.</span>
              </h1>
              <p className="lede">
                Research roles, TA-ships, internships, referrals and hackathon teams — inside one
                verified pipeline. <b>Not a network. Not a feed.</b> A pipeline with accountability,
                where every application is tracked, timestamped, and answered.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/register">
                  Explore opportunities →
                </Link>
                <a className="btn btn-ghost" href="#difference">
                  For faculty &amp; alumni
                </a>
              </div>
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

            <PipelineDemo />
          </div>
        </section>

        <div className="wrap">
          <div className="divider" />
        </div>

        {/* ── PROBLEM ── */}
        <section id="problem">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">The problem</span>
              <h2>
                Opportunities circulate through WhatsApp, noticeboards and word of mouth. Four
                failures follow.
              </h2>
              <p>
                We rank them. Ghosting — the silence after you apply — is the one Nexus is built to
                end first.
              </p>
            </div>
            <div className="fgrid">
              <Reveal className="fcard primary">
                <span className="tag">F3 · Resolution failure</span>
                <span className="badge-primary">Primary target</span>
                <h3>Applications vanish into silence</h3>
                <p>
                  Sent by email, they disappear. You can&apos;t tell &quot;rejected&quot; from
                  &quot;still reading&quot; from &quot;never opened.&quot; There is no accountability
                  for silence — until now.
                </p>
              </Reveal>
              {PROBLEMS.map((p) => (
                <Reveal key={p.tag} className="fcard muted">
                  <span className="tag">{p.tag}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DIFFERENCE ── */}
        <section id="difference">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Why it&apos;s different</span>
              <h2>A feed wants your attention. Nexus wants you gone — with a result.</h2>
              <p>The difference is structural, visible in what we measure and what we refuse to build.</p>
            </div>
            <Reveal className="split">
              <table>
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>A social / feed app</th>
                    <th className="n">Thapar Nexus</th>
                  </tr>
                </thead>
                <tbody>
                  {SPLIT.map(([dim, soc, nex]) => (
                    <tr key={dim}>
                      <td>{dim}</td>
                      <td className="soc">{soc}</td>
                      <td className="nex">{nex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <p style={{ marginTop: 22, color: "var(--faint)", fontSize: 14 }}>
              No infinite feed · no likes · no follower counts · no vanity metrics —{" "}
              <span style={{ color: "var(--muted)" }}>excluded on purpose.</span>
            </p>
          </div>
        </section>

        {/* ── PIPELINE / STATUS ── */}
        <section id="pipeline">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Status legibility</span>
              <h2>Every application has one unambiguous state.</h2>
              <p>
                Colour, icon and label together — so where you stand is never a guess, and never a
                colour alone.
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

        {/* ── FEATURES ── */}
        <section id="features">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">What only Nexus can do</span>
              <h2>Four things a feed structurally cannot.</h2>
              <p>Each depends on the application record existing as a first-class entity.</p>
            </div>
            <div className="dgrid">
              {FEATURES.map((f) => (
                <Reveal key={f.num} className="dcard">
                  <span className="num">{f.num}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <div className="pillline">
                    {f.tags.map((t) => (
                      <span key={t} className={`tag-skill ${f.attested ? "att" : "req"}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── SAMPLE CARD ── */}
        <section>
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">The unit of work</span>
              <h2>A posting tells you everything, and answers you on time.</h2>
            </div>
            <div className="showcase">
              <Reveal className="opp">
                <div className="opp-top">
                  <span className="opp-type">Research · ML</span>
                  <span className="opp-dl">⏳ 4 days left</span>
                </div>
                <h3>NLP Research Assistant</h3>
                <div className="prof">
                  <span>Dr. A. Rao · CSED</span>
                  <span className="resp">
                    <span className="rdot" />
                    Responsive · 18h median TTA
                  </span>
                </div>
                <div className="opp-hr" />
                <div className="skills">
                  <span className="lbl">Required</span>
                  <span className="tag-skill req">Python</span>
                  <span className="tag-skill req">PyTorch</span>
                  <span className="tag-skill req">NLP</span>
                  <span className="lbl" style={{ marginLeft: 6 }}>
                    Preferred
                  </span>
                  <span className="tag-skill">CUDA</span>
                </div>
                <div className="opp-foot">
                  <span className="meta">2 seats · Stipend · Aug–Nov 2026</span>
                  <span className="acts">
                    <button type="button" className="mini">
                      Save
                    </button>
                    <Link className="mini solid" href="/register">
                      Apply
                    </Link>
                  </span>
                </div>
              </Reveal>
              <div>
                <p style={{ fontSize: 17, color: "var(--muted)", margin: "0 0 18px" }}>
                  Structured fields, a controlled skill vocabulary, and a visible responsiveness
                  record. You read a posting in seconds and know exactly what it wants — and how
                  fast this poster tends to reply.
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    color: "var(--muted)",
                    fontSize: 15,
                  }}
                >
                  <li>◦ &nbsp;Skills drawn from an admin-curated taxonomy — never free text.</li>
                  <li>◦ &nbsp;Deadlines auto-expire; nothing lingers past its date.</li>
                  <li>
                    ◦ &nbsp;Match results always show <span style={{ color: "var(--text)" }}>why</span>{" "}
                    — matched and missing tags, never a bare score.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="cta">
          <div className="wrap">
            <Reveal className="cta-band">
              <h2>Apply once. Always know where you stand.</h2>
              <p>
                Join the pilot at Thapar Institute — find a posting in under two minutes, apply, and
                get a real answer within 48 hours.
              </p>
              <div className="cta-actions">
                <Link className="btn btn-primary" href="/register">
                  Create your profile
                </Link>
                <a
                  className="btn btn-ghost"
                  href="https://github.com/HarshdeepAthawale/UCS503-Software-Engineering"
                  target="_blank"
                  rel="noopener"
                >
                  View the project ↗
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <a className="brand" href="#top">
                <span className="mark">N</span> Thapar&nbsp;Nexus
              </a>
              <p>
                A verified opportunity pipeline for the institute — built to make sure an
                application reaches a decision, and to make it visible when it doesn&apos;t.
              </p>
            </div>
            <div className="foot-team">
              <div className="h">Team · UCS503</div>
              <div>Harshdeep Athawale · 1024031062</div>
              <div>Aakriti Chauhan · 1024031055</div>
              <div>Sehaj Dhillon · 1024030620</div>
            </div>
            <div className="foot-team">
              <div className="h">Institute</div>
              <div>Thapar Institute of</div>
              <div>Engineering &amp; Technology</div>
              <div>Patiala, Punjab</div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Thapar Nexus · Software Engineering course project</span>
            <a
              href="https://github.com/HarshdeepAthawale/UCS503-Software-Engineering"
              target="_blank"
              rel="noopener"
            >
              github.com/HarshdeepAthawale/UCS503-Software-Engineering ↗
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
