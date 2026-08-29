import Link from "next/link";

/**
 * App Router 404.
 *
 * Without this file Next has no App Router page to render for a missing route
 * and falls back to the Pages-router `/_error` document — which is what broke
 * the Render build with "<Html> should not be imported outside of
 * pages/_document" while prerendering /500 and /_error.
 */
export default function NotFound() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Page not found</h1>
        <p className="sub">
          That link doesn&apos;t point anywhere on Nexus — it may have been moved
          or the posting may have closed.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/opportunities">
            Browse opportunities
          </Link>
          <Link className="btn btn-ghost" href="/">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
