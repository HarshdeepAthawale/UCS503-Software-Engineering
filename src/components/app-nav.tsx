"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiLogout, type SessionUser } from "@/lib/client/api";
import { TiLogo } from "@/components/ti-logo";
import ThemeToggle from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { AppMobileTabBar } from "@/components/app-mobile-tab-bar";
import { AppMobileMenu } from "@/components/app-mobile-menu";

/**
 * Shared top navigation for authenticated app screens. Role-aware: only
 * faculty/alumni see "Post". The API still enforces RBAC - this only hides what
 * a role cannot do, it is never the security boundary.
 *
 * On phones, primary destinations move to the bottom tab bar; the header stays
 * minimal and a overflow menu holds secondary links.
 */
export function AppNav({ user, unread = 0 }: { user: SessionUser | null; unread?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const canPost = user?.role === "FACULTY" || user?.role === "ALUMNI";

  const link = (href: string, label: string, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`appnav-link${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {label}
        {badge ? <span className="appnav-badge">{badge}</span> : null}
      </Link>
    );
  };

  async function onLogout() {
    await apiLogout();
    router.push("/");
  }

  return (
    <>
      <header className="appnav">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <div className="appnav-inner wrap">
          <Link className="brand" href={user ? "/opportunities" : "/"}>
            <TiLogo size={26} className="ti-mark" />
            <span className="appnav-wordmark">Nexus</span>
          </Link>
          {user ? (
            <>
              <nav className="appnav-links" aria-label="Main">
                {link("/opportunities", "Feed")}
                {user.role === "STUDENT" && link("/applications", "Applications")}
                {canPost && link("/opportunities/mine", "My postings")}
                {link("/teams", "Teams")}
                {user.role === "STUDENT" && link("/teams/mine", "My Teams")}
                {link("/messages", "Messages")}
                {link("/notifications", "Notifications", unread)}
                {user.role === "ADMIN" && link("/admin", "Admin")}
                {link("/profile", "Profile")}
              </nav>
              <div className="appnav-cta">
                <CommandPalette user={user} />
                <ThemeToggle />
                <AppMobileMenu user={user} />
                {canPost && (
                  <Link className="btn btn-primary btn-sm appnav-post" href="/opportunities/new">
                    + Post
                  </Link>
                )}
                <button className="btn btn-ghost btn-sm appnav-signout" type="button" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="appnav-cta">
              <CommandPalette user={null} />
              <ThemeToggle />
              <Link className="btn btn-primary btn-sm" href="/login">Sign in</Link>
            </div>
          )}
        </div>
      </header>

      {user ? <AppMobileTabBar user={user} unread={unread} /> : null}

      {user && canPost ? (
        <Link className="app-fab" href="/opportunities/new" aria-label="Post an opportunity">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </Link>
      ) : null}
    </>
  );
}
