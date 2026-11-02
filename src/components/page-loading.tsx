"use client";

import { AppNav } from "@/components/app-nav";
import { getUser } from "@/lib/client/api";

/**
 * Shown while a page works out who is signed in. It keeps the navigation bar
 * in place and shows the page's rough shape, so nothing jumps when the real
 * page appears (a bare "Loading..." with no bar made the whole screen flash).
 */
export function PageLoading() {
  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page" aria-busy="true">
        <div className="wrap page-stack">
          <span className="sr-only" role="status">Loading…</span>
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </main>
    </div>
  );
}
