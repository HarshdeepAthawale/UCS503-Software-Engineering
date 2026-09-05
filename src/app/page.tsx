import Link from "next/link";
import PipelineDemo from "@/components/pipeline-demo";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const POINTS = [
  "Research, internships, TA roles, and teams — one institute-wide feed.",
  "Posters pledge a response time; slow replies show on their profile.",
  "Messages stay inside an application — no unsolicited DMs.",
] as const;

/**
 * Landing — split layout with product visual and a short sign-in funnel.
 */
export default function Home() {
  return (
    <div className="landing">
      <SiteNav />
      <main id="top" className="landing-main">
        <div className="landing-split">
          <div className="landing-copy">
            <p className="landing-eyebrow">Thapar Institute of Engineering &amp; Technology</p>
            <h1>Track every application to a decision.</h1>
            <p className="landing-lede">
              Nexus replaces scattered WhatsApp forwards with a verified pipeline.
              Students apply in minutes; faculty and alumni post with an SLA — and
              silence is never invisible.
            </p>
            <ul className="landing-points">
              {POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="landing-actions">
              <Link className="btn btn-primary btn-lg" href="/register">
                Create your profile
              </Link>
              <Link className="btn btn-ghost btn-lg" href="/login">
                Sign in
              </Link>
            </div>
            <p className="landing-meta">
              Pilot for the institute community ·{" "}
              <Link href="/product">See how it works</Link>
            </p>
          </div>

          <div className="landing-visual">
            <p className="landing-visual-label">Live application tracker</p>
            <PipelineDemo />
          </div>
        </div>
      </main>
      <SiteFooter minimal />
    </div>
  );
}
