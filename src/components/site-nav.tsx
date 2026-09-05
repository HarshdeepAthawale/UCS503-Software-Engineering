"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { TiLogo } from "@/components/ti-logo";

const LINKS = [
  { href: "/product", label: "Product" },
  { href: "/about", label: "About" },
] as const;

/** Marketing header — flat bar, no floating dock. */
export function SiteNav() {
  const path = usePathname();

  return (
    <header className="site-header">
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <div className="site-header-inner wrap">
        <Link className="brand" href="/">
          <TiLogo size={28} className="ti-mark" priority />
          <span>Thapar Nexus</span>
        </Link>

        <nav className="site-header-links" aria-label="Primary">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : undefined}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="site-header-cta">
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
