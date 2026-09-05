"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiLogout, type SessionUser } from "@/lib/client/api";
import { TiLogo } from "@/components/ti-logo";
import ThemeToggle from "@/components/theme-toggle";

/**
 * Shared top navigation for authenticated app screens. Role-aware: only
 * faculty/alumni see "Post". The API still enforces RBAC - this only hides what
 * a role cannot do, it is never the security boundary.
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
            <nav className="appnav-links">
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
              <ThemeToggle />
              {canPost && (
                <Link className="btn btn-primary btn-sm" href="/opportunities/new">
                  + Post
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" type="button" onClick={onLogout}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          // No session - nothing here is worth linking to, only a way in.
          <div className="appnav-cta">
            <ThemeToggle />
            <Link className="btn btn-primary btn-sm" href="/login">Sign in</Link>
          </div>
        )}
      </div>
    </header>
  );
}
