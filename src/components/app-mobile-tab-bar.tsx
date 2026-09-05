"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/client/api";

type Tab = {
  href: string;
  label: string;
  icon: "feed" | "apps" | "messages" | "alerts" | "profile";
  active: (path: string) => boolean;
  badge?: number;
};

function feedActive(path: string) {
  if (path === "/opportunities") return true;
  if (!path.startsWith("/opportunities/")) return false;
  if (path.startsWith("/opportunities/mine")) return false;
  if (path === "/opportunities/new") return false;
  return !path.includes("/edit");
}

function tabsFor(user: SessionUser, unread: number): Tab[] {
  const appsTab: Tab =
    user.role === "STUDENT"
      ? {
          href: "/applications",
          label: "Applications",
          icon: "apps",
          active: (p) => p === "/applications" || p.startsWith("/applications/"),
        }
      : {
          href: "/opportunities/mine",
          label: "Postings",
          icon: "apps",
          active: (p) => p.startsWith("/opportunities/mine"),
        };

  return [
    { href: "/opportunities", label: "Feed", icon: "feed", active: feedActive },
    appsTab,
    {
      href: "/messages",
      label: "Messages",
      icon: "messages",
      active: (p) => p === "/messages" || p.startsWith("/messages/"),
    },
    {
      href: "/notifications",
      label: "Alerts",
      icon: "alerts",
      active: (p) => p === "/notifications" || p.startsWith("/notifications/"),
      badge: unread > 0 ? unread : undefined,
    },
    {
      href: "/profile",
      label: "Profile",
      icon: "profile",
      active: (p) => p === "/profile" || p.startsWith("/profile/"),
    },
  ];
}

const ICONS = {
  feed: (
    <path d="M4 6.5h16M4 12h10M4 17.5h14" />
  ),
  apps: (
    <path d="M7 4h10v6H7zM5 14h6v6H5zM13 14h6v6h-6z" />
  ),
  messages: (
    <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-12z" />
  ),
  alerts: (
    <path d="M12 4.5a4.5 4.5 0 0 0-4.5 4.5v2.8L5.5 15h13l-2-3.2V9a4.5 4.5 0 0 0-4.5-4.5Zm0 14.5a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z" />
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
} as const;

/** Bottom tab bar — primary navigation on phones (mobile SDK pattern). */
export function AppMobileTabBar({
  user,
  unread = 0,
}: {
  user: SessionUser;
  unread?: number;
}) {
  const path = usePathname();
  const tabs = tabsFor(user, unread);

  return (
    <nav className="app-mobile-tabs" aria-label="Main">
      {tabs.map((tab) => {
        const active = tab.active(path);
        const badge = tab.badge ?? 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-mobile-tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-mobile-tab-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[tab.icon]}
              </svg>
              {badge ? <span className="app-mobile-tab-badge">{badge > 9 ? "9+" : badge}</span> : null}
            </span>
            <span className="app-mobile-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
