"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/client/api";
import { tabNav } from "@/lib/client/nav";
import { NavIcon } from "@/components/nav-icon";

/**
 * Bottom tab bar - primary navigation on phones. Same destinations as the
 * desktop bar (lib/client/nav.ts) plus Profile; notifications live on the bell
 * in the top bar.
 */
export function AppMobileTabBar({ user }: { user: SessionUser }) {
  const path = usePathname();

  return (
    <nav className="app-mobile-tabs" aria-label="Main">
      {tabNav(user).map((tab) => {
        const active = tab.match(path);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-mobile-tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <NavIcon name={tab.icon} size={22} />
            <span className="app-mobile-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
