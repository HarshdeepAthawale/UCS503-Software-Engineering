import Link from "next/link";
import type { HttpCatalogEntry } from "@/lib/http/catalog";

/**
 * Member-facing screen for a single HTTP status (404, 500, etc.).
 * Does not render machine internals — only human copy and a correlation id.
 */
export function HttpStatusScreen({
  entry,
  reference,
  retry,
}: {
  entry: HttpCatalogEntry;
  reference?: string;
  retry?: () => void;
}) {
  const primaryHref = entry.status === 401 ? "/" : "/opportunities";
  const primaryLabel = entry.status === 401 ? "Sign in" : "Browse opportunities";

  return (
    <main className="auth-shell" id="content">
      <div className="auth-card http-status-card">
        <p className="http-status-code mono">{entry.status}</p>
        <h1>{entry.title}</h1>
        <p className="sub">{entry.meaning}</p>
        <p className="empty-note">{entry.when}</p>
        {reference ? <p className="empty-note">Reference: {reference}</p> : null}
        <div className="hero-actions">
          {retry ? (
            <button className="btn btn-primary" type="button" onClick={retry}>
              Try again
            </button>
          ) : (
            <Link className="btn btn-primary" href={primaryHref}>
              {primaryLabel}
            </Link>
          )}
          <Link className="btn btn-ghost" href="/">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
