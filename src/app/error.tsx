"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * App Router error boundary for anything thrown while rendering a route.
 *
 * `error.tsx` must be a client component and receives `reset` to retry the
 * segment without a full reload.
 *
 * Nothing from `error` is rendered: a server-side message can carry internals
 * (a query, a path, a driver string) and this page is shown to whoever hit the
 * route. The digest is the safe handle — it correlates to the server log entry
 * without disclosing anything itself.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Something went wrong</h1>
        <p className="sub">
          This page failed to load. Trying again often clears it; if it doesn&apos;t,
          the problem is on our side.
        </p>
        {error.digest && <p className="empty-note">Reference: {error.digest}</p>}
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="btn btn-ghost" href="/opportunities">
            Back to opportunities
          </Link>
        </div>
      </div>
    </main>
  );
}
