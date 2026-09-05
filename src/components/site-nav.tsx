"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { TiLogo } from "@/components/ti-logo";

/**
 * Marketing navigation - a floating dock, after owasptiet.vercel.app.
 *
 * Taken from the reference: a rounded pill floating a little below the top
 * edge rather than a full-bleed bar, icon targets at 44px, and a label that
 * fades in underneath on hover.
 *
 * The pill is translucent with a backdrop blur, as the reference's is. It was
 * opaque at first on the reasoning that this system has no blur anywhere; that
 * was overruled, and the glass is the point of the reference's dock.
 *
 * What it is NOT is a literal `bg-black/30`. The translucency is a share of
 * `--surface`, so the same rule thins the warm card colour on paper and the
 * raised charcoal on near-black - a fixed black would go grey and muddy over
 * the cream canvas, which is the real failure mode here. Light carries a
 * higher alpha than dark, because dark text over a light blur needs more
 * backing than light text over a dark one. See globals.css `.dock-pill`.
 *
 * It is `sticky`, not `fixed`. Fixed takes the dock out of flow, and each of
 * the three marketing pages would then need its own top clearance - exactly
 * the kind of magic number that drifts out of sync. Sticky reserves its own
 * height, so nothing below has to know the dock is there.
 *
 * The brand and the CTA stay as text. The reference is a club site where every
 * destination is peer-level; this is a product landing page, where the
 * wordmark and "Get started" are the two things a first-time visitor most
 * needs to find.
 */

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.75 20v-5.5h4.5V20" />,
  product: (
    <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  ),
  about: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M2.75 19.25a6.25 6.25 0 0 1 12.5 0M16.5 5.6a3.25 3.25 0 0 1 0 5.8M18.25 19.25a6.3 6.3 0 0 0-2.4-4.95" />
    </>
  ),
} as const;

type NavLink = { href: string; label: string; icon: keyof typeof ICONS };

const LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/product", label: "Product", icon: "product" },
  { href: "/about", label: "About", icon: "about" },
];

export function SiteNav() {
  const path = usePathname();

  return (
    <header className="dock">
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <div className="dock-pill">
        <Link className="dock-brand" href="/">
          <TiLogo size={26} className="ti-mark" priority />
          <span className="dock-wordmark">Nexus</span>
        </Link>

        <span className="dock-rule" aria-hidden="true" />

        <nav className="dock-links" aria-label="Primary">
          {LINKS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`dock-item${path === href ? " active" : ""}`}
              // The label only appears on hover, so it cannot serve as the
              // accessible name. Without this the link announces as its URL.
              aria-label={label}
              aria-current={path === href ? "page" : undefined}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[icon]}
              </svg>
              {/* Fades in below the dock on hover, as the reference does.
                  aria-hidden because the link already carries this string as
                  its accessible name, and announcing it twice is worse than
                  not announcing it at all. */}
              <span className="dock-tip" aria-hidden="true">
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <span className="dock-rule" aria-hidden="true" />

        <div className="dock-cta">
          <ThemeToggle />
          <Link className="btn btn-ghost btn-sm nav-signin" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary btn-sm" href="/register">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
