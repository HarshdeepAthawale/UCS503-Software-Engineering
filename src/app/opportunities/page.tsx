"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { NavIcon } from "@/components/nav-icon";
import { OpportunityCard } from "@/components/opportunity-card";
import { SignInRequired } from "@/components/sign-in-required";
import {
  apiGetMyProfile,
  apiListOpportunities,
  bootstrapSession,
  getUser,
  type OppType,
  type Opportunity,
  type OpportunitySort,
} from "@/lib/client/api";
import type { EligibilityProfile } from "@/lib/client/eligibility";
import { oppTypeLabel } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { canPost } from "@/lib/client/nav";
import {
  DEFAULT_FILTERS,
  filtersFromQuery,
  filtersToQuery,
  hasActiveFilters,
  type OpportunityFilters,
} from "@/lib/client/opportunity-filters";

const TYPES: OppType[] = ["RESEARCH", "INTERNSHIP", "TA", "MICRO_TASK", "REFERRAL", "HACKATHON_TEAM"];
const PAY: { value: OpportunityFilters["stipend"]; label: string }[] = [
  { value: "", label: "Any pay" },
  { value: "true", label: "Paid" },
  { value: "false", label: "Unpaid" },
];
const SORTS: { value: OpportunitySort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "deadline", label: "Closing soon" },
  { value: "seats", label: "Most seats open" },
];
/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 250;

/**
 * Discovery. Search and filters live in the URL (shareable, survive Back); a
 * student sees on every card whether they meet its eligibility criteria.
 */
export default function OpportunitiesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [viewer, setViewer] = useState<EligibilityProfile | null | undefined>(undefined);

  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState(""); // the search box, ahead of the debounce
  const [items, setItems] = useState<Opportunity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may update the list - an older, slower response
  // must not overwrite results for a filter the user has already changed.
  const latest = useRef(0);

  const load = useCallback(
    async (f: OpportunityFilters, after?: string) => {
      const id = ++latest.current;
      setLoading(true);
      setError(null);
      try {
        const res = await apiListOpportunities({
          q: f.q.trim() || undefined,
          type: f.type || undefined,
          stipend: f.stipend || undefined,
          sort: f.sort,
          cursor: after,
        });
        if (id !== latest.current) return;
        setItems((prev) => (after ? [...prev, ...res.opportunities] : res.opportunities));
        setCursor(res.nextCursor);
      } catch (err) {
        if (id !== latest.current || handleLoadError(router, err)) return;
        setError(loadErrorMessage(err, "Could not load opportunities."));
      } finally {
        if (id === latest.current) setLoading(false);
      }
    },
    [router],
  );

  // Sign in, read filters from the URL, and (for students) the fields that
  // eligibility is checked against.
  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (!ok) return;
      const initial = filtersFromQuery(new URLSearchParams(window.location.search));
      setFilters(initial);
      setQuery(initial.q);
      void load(initial);
      if (getUser()?.role === "STUDENT") {
        apiGetMyProfile()
          .then((p) => setViewer(p ? { branch: p.branch, cgpa: p.cgpa, backlogs: p.backlogs } : null))
          .catch(() => setViewer(null));
      }
    })();
  }, [load]);

  function apply(next: OpportunityFilters) {
    setFilters(next);
    const qs = filtersToQuery(next);
    router.replace(qs ? `/opportunities?${qs}` : "/opportunities", { scroll: false });
    void load(next);
  }
  const patch = (p: Partial<OpportunityFilters>) => apply({ ...filters, ...p });

  // Debounced search as the user types.
  useEffect(() => {
    if (!ready || query === filters.q) return;
    const t = setTimeout(() => patch({ q: query }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (ready && !signedIn) {
    return (
      <SignInRequired message="Sign in to browse opportunities.">
        <Link className="btn btn-ghost" href="/register">Create account</Link>
      </SignInRequired>
    );
  }

  const user = getUser();
  const filtered = hasActiveFilters(filters);
  const clear = () => {
    setQuery("");
    apply(DEFAULT_FILTERS);
  };

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="page-title-row">
            <div>
              <h1>Opportunities</h1>
              <p className="sub">Research projects, internships, TA roles and more from across the institute.</p>
            </div>
            {user && canPost(user) && (
              <Link className="btn btn-primary" href="/opportunities/new">Post an opportunity</Link>
            )}
          </div>

          <section className="discover-controls" aria-label="Search and filter">
            <form className="search-input" role="search" onSubmit={(e) => { e.preventDefault(); patch({ q: query }); }}>
              <NavIcon name="search" size={18} />
              <label htmlFor="opp-search" className="sr-only">Search opportunities</label>
              <input id="opp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, topic or keyword" />
            </form>

            <div className="chip-row" role="group" aria-label="Type">
              <button type="button" className={`chip${filters.type === "" ? " is-on" : ""}`} aria-pressed={filters.type === ""}
                onClick={() => patch({ type: "" })}>
                All types
              </button>
              {TYPES.map((t) => (
                <button key={t} type="button" className={`chip${filters.type === t ? " is-on" : ""}`} aria-pressed={filters.type === t}
                  onClick={() => patch({ type: filters.type === t ? "" : t })}>
                  {oppTypeLabel(t)}
                </button>
              ))}
            </div>

            <div className="discover-bar">
              <div className="segmented" role="group" aria-label="Pay">
                {PAY.map((p) => (
                  <button key={p.label} type="button" className={filters.stipend === p.value ? "is-on" : ""}
                    aria-pressed={filters.stipend === p.value} onClick={() => patch({ stipend: p.value })}>
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="sort-select">
                <span>Sort</span>
                <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value as OpportunitySort })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready || (loading && items.length === 0) ? (
            <div className="card-grid" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton-card" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-card">
              {filtered ? (
                <>
                  <h3>Nothing matches these filters</h3>
                  <p>Try a broader search or another type.</p>
                  <button className="btn btn-ghost" type="button" onClick={clear}>Clear filters</button>
                </>
              ) : (
                <>
                  <h3>No opportunities posted yet</h3>
                  <p>{user && canPost(user) ? "Be the first - post a research role, internship or TA opening." : "New postings from faculty and alumni will appear here."}</p>
                  {user && canPost(user) && <Link className="btn btn-primary" href="/opportunities/new">Post an opportunity</Link>}
                </>
              )}
            </div>
          ) : (
            <>
              <p className="result-line" aria-live="polite">
                {loading ? "Updating…" : `Showing ${items.length}${cursor ? "+" : ""} opportunit${items.length === 1 ? "y" : "ies"}`}
                {filtered && !loading && (
                  <button className="linklike" type="button" onClick={clear}>Clear filters</button>
                )}
              </p>
              <div className="card-grid">
                {items.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} viewer={user?.role === "STUDENT" ? viewer ?? null : undefined} />
                ))}
              </div>
              {cursor && (
                <div className="load-more">
                  <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void load(filters, cursor)}>
                    {loading ? "Loading…" : "Show more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
