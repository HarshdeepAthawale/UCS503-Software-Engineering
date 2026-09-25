"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { OpportunityCard } from "@/components/opportunity-card";
import { OpportunityFacetBar, type OpportunityFilters } from "@/components/opportunity-facet-bar";
import {
  apiListOpportunities,
  bootstrapSession,
  getUser,
  type Opportunity,
} from "@/lib/client/api";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { SignInRequired } from "@/components/sign-in-required";

const DEFAULT_FILTERS: OpportunityFilters = {
  q: "",
  type: "",
  domain: "",
  stipend: "",
  sort: "recent",
};

export default function OpportunitiesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [items, setItems] = useState<Opportunity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiListOpportunities({
          q: filters.q.trim() || undefined,
          type: filters.type || undefined,
          domain: filters.domain.trim() || undefined,
          stipend: filters.stipend || undefined,
          sort: filters.sort,
          cursor: reset ? undefined : cursor ?? undefined,
        });
        setItems((prev) => (reset ? res.opportunities : [...prev, ...res.opportunities]));
        setCursor(res.nextCursor);
      } catch (err) {
        if (handleLoadError(router, err)) return;
        setError(loadErrorMessage(err, "Could not load opportunities."));
      } finally {
        setLoading(false);
      }
    },
    [filters, cursor, router],
  );

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void fetchPage(true), 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, filters]);

  function patchFilters(patch: Partial<OpportunityFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  if (!ready) {
    return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  }
  if (!signedIn) {
    return (
      <SignInRequired message="Sign in to browse opportunities.">
        <Link className="btn btn-ghost" href="/register">Create account</Link>
      </SignInRequired>
    );
  }

  const user = getUser();
  const canPost = user?.role === "FACULTY" || user?.role === "ALUMNI";

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head opp-page-head">
            <div>
              <h1>Opportunities</h1>
              <p className="sub">
                Research projects, internships, TA roles and hackathon teams from across the institute.
              </p>
            </div>
            {canPost && (
              <Link className="btn btn-primary" href="/opportunities/new">Post opportunity</Link>
            )}
          </div>

          <OpportunityFacetBar
            filters={filters}
            onChange={patchFilters}
            onClear={clearFilters}
            resultCount={items.length}
            loading={loading && items.length === 0}
          />

          {error && <p className="form-err" role="alert">{error}</p>}

          {items.length === 0 && !loading ? (
            <div className="app-empty opp-empty">
              <h3>No opportunities match</h3>
              <p>Try clearing a filter or broadening your search.</p>
              <button className="btn btn-ghost" type="button" onClick={clearFilters}>
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="feed-grid">
              {items.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          )}

          {loading && items.length > 0 && (
            <p className="empty-note" style={{ textAlign: "center", marginTop: 16 }}>Updating results…</p>
          )}

          {cursor && (
            <div className="load-more">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={loading}
                onClick={() => void fetchPage(false)}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
