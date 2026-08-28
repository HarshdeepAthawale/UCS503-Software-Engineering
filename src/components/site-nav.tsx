"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { TiLogo } from "@/components/ti-logo";

/** Shared marketing navigation across the three landing pages. */
export function SiteNav() {
  const path = usePathname();
  const links: [string, string][] = [
    ["/", "Home"],
    ["/product", "Product"],
    ["/about", "About"],
  ];
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link className="brand" href="/">
          <TiLogo size={30} className="ti-mark" /> Thapar&nbsp;Nexus
        </Link>
        <nav className="nav-links">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-cta">
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
