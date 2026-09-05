"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiLogout, type SessionUser } from "@/lib/client/api";

type Item = { href?: string; label: string; action?: () => void };

function itemsFor(user: SessionUser, onLogout: () => void): Item[] {
  const canPost = user.role === "FACULTY" || user.role === "ALUMNI";
  const rows: Item[] = [];
  if (user.role === "STUDENT") {
    rows.push({ href: "/teams", label: "Teams" });
  }
  if (canPost) {
    rows.push({ href: "/opportunities/new", label: "Post opportunity" });
  }
  if (user.role === "ADMIN") {
    rows.push({ href: "/admin", label: "Admin console" });
  }
  rows.push({ label: "Sign out", action: onLogout });
  return rows;
}

/** Overflow menu for secondary destinations on mobile. */
export function AppMobileMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function onLogout() {
    setOpen(false);
    await apiLogout();
    router.push("/");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const items = itemsFor(user, () => void onLogout());

  return (
    <div className="app-mobile-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn app-mobile-menu-trigger"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open ? (
        <div className="app-mobile-menu-sheet" role="menu">
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="app-mobile-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                className="app-mobile-menu-item"
                role="menuitem"
                onClick={item.action}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
