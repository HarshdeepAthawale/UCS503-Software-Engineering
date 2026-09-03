import Link from "next/link";
import type { ReactNode } from "react";
import { TiLogo } from "@/components/ti-logo";

const PILLS = [
  ["●", "Applied", "p-applied"],
  ["◉", "Acknowledged", "p-received"],
  ["✔", "Selected", "p-selected"],
  ["⚠", "At Risk", "p-atrisk"],
] as const;

/**
 * Two-column auth layout: a branded panel on the left, the form card on the
 * right. Fills the page so an auth screen never reads as a lonely card on a void.
 * The panel stacks above the card on narrow screens.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-split">
      <aside className="auth-aside">
        <div className="hero-glow" aria-hidden="true" />
        <div className="auth-aside-inner">
          <Link className="brand" href="/">
            <TiLogo size={34} className="ti-mark" />
          </Link>
          <h2>
            Apply once. <span className="grad-text">Always know where you stand.</span>
          </h2>
          <ul className="ticklist">
            <li>Discover a relevant posting in under two minutes.</li>
            <li>Every application is timestamped and answered.</li>
            <li>Posters pledge an SLA - silence becomes visible.</li>
          </ul>
          <div className="pillwrap" style={{ marginTop: 28 }}>
            {PILLS.map(([g, label, cls]) => (
              <span key={label} className={`pill ${cls}`}>
                <span className="g">{g}</span> {label}
              </span>
            ))}
          </div>
        </div>
      </aside>
      <div className="auth-main">{children}</div>
    </main>
  );
}
