import Link from "next/link";
import Reveal from "@/components/reveal";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "About · Thapar Nexus" };

const PROBLEMS = [
  {
    tag: "F1 · Discovery",
    title: "Postings are missed",
    body: "Circulation is channel-dependent. Not in the right group? You never see the opening.",
  },
  {
    tag: "F2 · Authenticity",
    title: "Details drift",
    body: "Forwarded messages lose provenance. Deadlines mutate; nobody can confirm who posted.",
  },
  {
    tag: "F4 · Competency",
    title: "Every skill is self-claimed",
    body: "A poster has no way to verify a claimed skill maps to real work.",
  },
];

const TEAM = [
  { name: "Harshdeep Athawale", roll: "1024031062" },
  { name: "Aakriti Chauhan", roll: "1024031055" },
  { name: "Sehaj Dhillon", roll: "1024030620" },
];

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <section className="page-hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">The thesis</span>
            <h1>Opportunities circulate through WhatsApp, noticeboards and word of mouth.</h1>
            <p className="lede">
              Four failures follow. We rank them - and <b>ghosting</b>, the silence after you apply,
              is the one Nexus is built to end first.
            </p>
          </div>
        </section>

        {/* PROBLEM GRID */}
        <section id="problem">
          <div className="wrap">
            <div className="fgrid">
              <Reveal className="fcard primary">
                <span className="tag">F3 · Resolution failure</span>
                <span className="badge-primary">Primary target</span>
                <h3>Applications vanish into silence</h3>
                <p>
                  Sent by email, they disappear. You can&apos;t tell &quot;rejected&quot; from
                  &quot;still reading&quot; from &quot;never opened.&quot; There is no accountability
                  for silence - until now.
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

        {/* PHILOSOPHY */}
        <section>
          <div className="wrap">
            <Reveal className="quote-band">
              <p className="quote">
                &ldquo;A feed measures attention and rewards the most-followed. Nexus measures
                resolution and rewards the most-responsive. We optimise for you leaving - with a
                result.&rdquo;
              </p>
              <p className="quote-by">- The Nexus design principle</p>
            </Reveal>
          </div>
        </section>

        {/* TEAM + INSTITUTE */}
        <section id="team">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Who built it</span>
              <h2>A UCS503 Software Engineering project at Thapar Institute.</h2>
            </div>
            <div className="steps">
              {TEAM.map((m) => (
                <Reveal key={m.roll} className="step teamcard">
                  <div className="avatar" aria-hidden="true">{m.name.split(" ").map((w) => w[0]).join("")}</div>
                  <h3>{m.name}</h3>
                  <p className="mono">{m.roll}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="inst-band">
              <div>
                <div className="h">Institute</div>
                <p>Thapar Institute of Engineering &amp; Technology · Patiala, Punjab (Deemed to be University)</p>
              </div>
              <a
                className="btn btn-ghost"
                href="https://github.com/HarshdeepAthawale/UCS503-Software-Engineering"
                target="_blank"
                rel="noopener"
              >
                View the project ↗
              </a>
            </Reveal>
          </div>
        </section>

        <section id="cta">
          <div className="wrap">
            <Reveal className="cta-band">
              <h2>Apply once. Always know where you stand.</h2>
              <p>Join the pilot - find a posting in under two minutes and get a real answer within 48 hours.</p>
              <div className="cta-actions">
                <Link className="btn btn-primary" href="/register">Create your profile</Link>
                <Link className="btn btn-ghost" href="/product">See the product</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
