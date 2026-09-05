import Link from "next/link";
import type { HttpCatalogEntry } from "@/lib/http/catalog";

/**
 * Shared chrome for a single HTTP status: live 404/500 screens and `/errors/:code`.
 * Does not render machine internals — only the catalogue copy and a correlation id.
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
  return (
    <main className="auth-shell" id="content">
      <div className="auth-card http-status-card">
        <p className="http-status-code mono">{entry.status}</p>
        <p className="eyebrow">{entry.code.replaceAll("_", " ")}</p>
        <h1>{entry.title}</h1>
        <p className="sub">{entry.meaning}</p>
        <p className="empty-note">{entry.when}</p>
        {reference ? <p className="empty-note">Reference: {reference}</p> : null}
        <div className="hero-actions">
          {retry ? (
            <button className="btn btn-primary" type="button" onClick={retry}>
              Try again
            </button>
          ) : null}
          {entry.status === 401 ? (
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          ) : (
            <Link className="btn btn-primary" href="/opportunities">
              Browse opportunities
            </Link>
          )}
          <Link className="btn btn-ghost" href="/errors">
            All HTTP codes
          </Link>
        </div>
      </div>
    </main>
  );
}
