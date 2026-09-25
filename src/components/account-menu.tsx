"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiLogout, type SessionUser } from "@/lib/client/api";
import { canPost, initials, roleLabel } from "@/lib/client/nav";
import { isAdminRole } from "@/lib/domain/admin-portal";

/**
 * The avatar menu at the right of the top bar, on every screen size: who is
 * signed in, their profile and email settings, and Sign out. Replaces the old
 * standalone Sign out button and the phone-only "…" menu.
 */
export function AccountMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const admin = isAdminRole(user.role);

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

  async function signOut() {
    setOpen(false);
    await apiLogout();
    // Each account type goes back to its own sign-in door.
    router.push(admin ? "/admin" : "/");
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-trigger"
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
      </button>
      {open ? (
        <div className="account-sheet" role="menu">
          <div className="account-head">
            <span className="avatar avatar-lg" aria-hidden="true">{initials(user.name)}</span>
            <span>
              <span className="account-name">{user.name}</span>
              <span className="account-role">{roleLabel(user.role)}</span>
            </span>
          </div>
          {!admin && (
            <Link className="account-item" role="menuitem" href="/profile" onClick={() => setOpen(false)}>
              Your profile
            </Link>
          )}
          {canPost(user) && (
            <Link className="account-item" role="menuitem" href="/opportunities/new" onClick={() => setOpen(false)}>
              Post an opportunity
            </Link>
          )}
          <Link className="account-item" role="menuitem" href="/notifications" onClick={() => setOpen(false)}>
            Notifications
          </Link>
          <button className="account-item account-signout" role="menuitem" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
