import Link from "next/link";
import Reveal from "@/components/reveal";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Product · Thapar Nexus" };

const FEATURES = [
  {
    num: "01",
    title: "Ghosting, made accountable",
    body: "Time-to-Acknowledgement is computed from immutable database timestamps - never self-reported. Posters carry a rolling Responsiveness Badge and pledge an SLA; breaches are flagged, not hidden.",
    tags: ["Immutable event log", "SLA pledge"],
  },
  {
    num: "02",
    title: "Attestations anchored to real work",
    body: "A skill endorsement can only exist where a completed, Selected application connects the two people. Enforced in the schema - so competency can't be farmed or traded between friends.",
    tags: ["✔ PyTorch · NLP RA", "Verified"],
    attested: true,
  },
  {
    num: "03",
    title: "An application budget",
    body: "Hold at most ten live applications at once. One constraint stops spray-and-pray applying and caps every poster's review load - the two-sided load control a feed has no reason to build.",
    tags: ["10 active slots", "Withdraw frees one"],
  },
  {
    num: "04",
    title: "Messaging that can't float free",
    body: "A thread exists only inside an application or a team - never a free-form DM. Safety by design: an entire class of harassment simply has nowhere to live.",
    tags: ["Scoped threads", "Explainable matching"],
  },
];

const SPLIT = [
  ["Atomic unit", "A post", "An opportunity + application"],
  ["Success metric", "Engagement, time-on-app", "Time-to-Acknowledgement, decision rate"],
  ["Content lifetime", "Permanent, accumulating", "Deadline-bound, auto-expiring"],
  ["Who holds power", "The most-followed", "The most-responsive"],
  ["Optimal behaviour", "Use it more", "Use it less, get a result faster"],
];

export default function ProductPage() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <section className="page-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">The product</span>
            <h1>Four things a feed structurally cannot do.</h1>
            <p className="lede">
              Each depends on the application record existing as a first-class entity - tracked,
              timestamped, and enforced in the database, not just the UI.
            </p>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className="wrap">
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

        {/* SAMPLE CARD */}
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
                  <span className="lbl" style={{ marginLeft: 6 }}>Preferred</span>
                  <span className="tag-skill">CUDA</span>
                </div>
                <div className="opp-foot">
                  <span className="meta">2 seats · Stipend · Aug-Nov 2026</span>
                  <span className="acts">
                    <button type="button" className="mini">Save</button>
                    <Link className="mini solid" href="/register">Apply</Link>
                  </span>
                </div>
              </Reveal>
              <div>
                <p style={{ fontSize: 17, color: "var(--muted)", margin: "0 0 18px" }}>
                  Structured fields, a controlled skill vocabulary, and a visible responsiveness
                  record. You read a posting in seconds and know exactly what it wants - and how fast
                  this poster tends to reply.
                </p>
                <ul className="ticklist">
                  <li>Skills drawn from an admin-curated taxonomy - never free text.</li>
                  <li>Deadlines auto-expire; nothing lingers past its date.</li>
                  <li>Match results always show <span style={{ color: "var(--text)" }}>why</span> - matched and missing tags, never a bare score.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section id="difference">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Feed vs. pipeline</span>
              <h2>A feed wants your attention. Nexus wants you gone - with a result.</h2>
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
              No infinite feed · no likes · no follower counts · no vanity metrics -{" "}
              <span style={{ color: "var(--muted)" }}>excluded on purpose.</span>
            </p>
          </div>
        </section>

        <section id="cta">
          <div className="wrap">
            <Reveal className="cta-band">
              <h2>Ready to see it live?</h2>
              <p>Create a profile and browse the pilot - every posting is SLA-pledged.</p>
              <div className="cta-actions">
                <Link className="btn btn-primary" href="/register">Get started</Link>
                <Link className="btn btn-ghost" href="/about">Why we built it</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
