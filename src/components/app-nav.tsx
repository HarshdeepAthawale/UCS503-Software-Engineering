"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiListNotifications, type SessionUser } from "@/lib/client/api";
import { canPost, primaryNav } from "@/lib/client/nav";
import { TiLogo } from "@/components/ti-logo";
import { NavIcon } from "@/components/nav-icon";
import { AccountMenu } from "@/components/account-menu";
import { CommandPalette } from "@/components/command-palette";
import { AppMobileTabBar } from "@/components/app-mobile-tab-bar";

/**
 * Top bar for every signed-in screen.
 *
 *   desktop:  logo + name · role's destinations · search · Post · bell · avatar
 *   phone:    logo + name · bell · avatar  (destinations move to the bottom
 *             tab bar; each page's own heading names the page, so the bar
 *             does not repeat it)
 *
 * Destinations come from lib/client/nav.ts, shared with the tab bar. `unread`
 * may be passed by a page that already knows it (the notifications page keeps
 * it live); otherwise the bar fetches it itself.
 */
export function AppNav({ user, unread }: { user: SessionUser | null; unread?: number }) {
  const path = usePathname();
  const [fetched, setFetched] = useState(0);
  const count = unread ?? fetched;

  useEffect(() => {
    if (!user || unread !== undefined) return;
    void apiListNotifications()
      .then((n) => setFetched(n.unread))
      .catch(() => {});
  }, [user, unread]);

  if (!user) {
    return (
      <header className="appnav">
        <div className="appnav-inner wrap">
          <Link className="appnav-brand" href="/">
            <TiLogo size={28} priority />
            <span className="appnav-wordmark">Thapar Nexus</span>
          </Link>
          <div className="appnav-actions">
            <Link className="btn btn-primary btn-sm" href="/">Sign in</Link>
          </div>
        </div>
      </header>
    );
  }

  const items = primaryNav(user);

  return (
    <>
      <header className="appnav">
        <a className="skip-link" href="#content">Skip to content</a>
        <div className="appnav-inner wrap">
          <Link className="appnav-brand" href={items[0]?.href ?? "/opportunities"}>
            <TiLogo size={28} priority />
            <span className="appnav-wordmark">Thapar Nexus</span>
          </Link>

          <nav className="appnav-links" aria-label="Main">
            {items.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`appnav-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="appnav-actions">
            <CommandPalette user={user} />
            {canPost(user) && (
              <Link className="btn btn-primary btn-sm appnav-post" href="/opportunities/new">
                <NavIcon name="plus" size={16} /> Post
              </Link>
            )}
            <Link
              className={`appnav-bell${path === "/notifications" ? " active" : ""}`}
              href="/notifications"
              aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
            >
              <NavIcon name="bell" />
              {count ? <span className="appnav-badge">{count > 9 ? "9+" : count}</span> : null}
            </Link>
            <AccountMenu user={user} />
          </div>
        </div>
      </header>

      <AppMobileTabBar user={user} />

      {canPost(user) ? (
        <Link className="app-fab" href="/opportunities/new" aria-label="Post an opportunity">
          <NavIcon name="plus" size={22} />
        </Link>
      ) : null}
    </>
  );
}
