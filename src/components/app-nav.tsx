"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiLogout, type SessionUser } from "@/lib/client/api";
import { TiLogo } from "@/components/ti-logo";
import ThemeToggle from "@/components/theme-toggle";

/**
 * Shared top navigation for authenticated app screens. Role-aware: only
 * faculty/alumni see "Post". The API still enforces RBAC — this only hides what
 * a role cannot do, it is never the security boundary.
 */
export function AppNav({ user, unread = 0 }: { user: SessionUser | null; unread?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const canPost = user?.role === "FACULTY" || user?.role === "ALUMNI";

  const link = (href: string, label: string, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={`appnav-link${active ? " active" : ""}`}>
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
      <div className="appnav-inner wrap">
        <Link className="brand" href="/opportunities">
          <TiLogo size={26} className="ti-mark" /> Nexus
        </Link>
        <nav className="appnav-links">
          {link("/opportunities", "Feed")}
          {user?.role === "STUDENT" && link("/applications", "Applications")}
          {link("/notifications", "Notifications", unread)}
          {user?.role === "ADMIN" && link("/admin", "Admin")}
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
      </div>
    </header>
  );
}
