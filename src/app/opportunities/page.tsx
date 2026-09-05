"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { FacetTextInput, FilterSelect } from "@/components/filter-select";
import {
  apiListNotifications,
  apiListOpportunities,
  ApiError,
  bootstrapSession,
  getUser,
  type Opportunity,
  type OppType,
  type OpportunitySort,
} from "@/lib/client/api";
import { closesLabel, oppTypeHint, oppTypeLabel, POSTING_OPP_TYPES, slaLabel, statusClass, stipendLabel, titleCase } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { SignInRequired } from "@/components/sign-in-required";

const SORTS: { value: OpportunitySort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "deadline", label: "Closing soon" },
  { value: "seats", label: "Most seats open" },
];

/** Feed filter includes legacy hackathon postings still in the database. */
const FILTER_TYPES = [...POSTING_OPP_TYPES, "HACKATHON_TEAM"] as const;

export default function OpportunitiesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [unread, setUnread] = useState(0);

  const [items, setItems] = useState<Opportunity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | OppType>("");
  const [domain, setDomain] = useState("");
  const [stipend, setStipend] = useState<"" | "true" | "false">("");
  const [sort, setSort] = useState<OpportunitySort>("recent");

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiListOpportunities({
          q: q.trim() || undefined,
          type: type || undefined,
          domain: domain.trim() || undefined,
          stipend: stipend || undefined,
          sort,
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
    [q, type, domain, stipend, sort, cursor, router],
  );

  // Initial session bootstrap.
  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) {
        void apiListNotifications()
          .then((n) => setUnread(n.unread))
          .catch(() => {});
      }
    })();
  }, []);

  // Re-query whenever a facet changes (debounced on keyword).
  useEffect(() => {
    if (!signedIn) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void fetchPage(true), 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, q, type, domain, stipend, sort]);

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

  return (
    <div className="app-shell">
      <AppNav user={getUser()} unread={unread} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>Opportunities</h1>
              <p className="sub">Research, internships, TA roles and more - every posting SLA-pledged.</p>
            </div>
          </div>

          <div className="facet-bar">
            <div className="facet-bar-search">
              <label className="sr-only" htmlFor="opp-search">Search opportunities</label>
              <input
                id="opp-search"
                type="search"
                placeholder="Search titles & descriptions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="facet-bar-filters">
              <FilterSelect
                label="Type"
                value={type}
                onChange={(v) => setType(v as typeof type)}
                options={[
                  { value: "", label: "All types", hint: "No type filter" },
                  ...FILTER_TYPES.map((t) => ({
                    value: t,
                    label: oppTypeLabel(t),
                    hint: oppTypeHint(t),
                  })),
                ]}
              />
              <FacetTextInput
                id="opp-domain"
                label="Domain"
                value={domain}
                placeholder="e.g. ML"
                onChange={setDomain}
              />
              <FilterSelect
                label="Stipend"
                value={stipend}
                onChange={(v) => setStipend(v as typeof stipend)}
                options={[
                  { value: "", label: "Any stipend" },
                  { value: "true", label: "Stipend" },
                  { value: "false", label: "Unpaid" },
                ]}
              />
              <FilterSelect
                label="Sort"
                value={sort}
                onChange={(v) => setSort(v as OpportunitySort)}
                options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {items.length === 0 && !loading ? (
            <div className="app-empty">
              <h3>No opportunities match</h3>
              <p>Try clearing a filter or broadening your search.</p>
            </div>
          ) : (
            <div className="feed-grid">
              {items.map((o) => (
                <Link key={o.id} href={`/opportunities/${o.id}`} className="ocard">
                  <div className="ocard-top">
                    <span className="ocard-type">{oppTypeLabel(o.type)}</span>
                    <span className={`pill ${statusClass(o.status)}`}>{titleCase(o.status)}</span>
                  </div>
                  <h3>{o.title}</h3>
                  {/* Trust signal (docs/PRD §4): a student sees who is actually
                      behind a posting before they even open it, not just once
                      they click through. Plain text, not a nested link - the
                      whole card is already one <Link>. */}
                  <p className="tl-meta">
                    Posted by {o.poster.name} · {titleCase(o.poster.role)}
                  </p>
                  <p className="desc">{o.description}</p>
                  {o.skills.length > 0 && (
                    <div className="tagrow">
                      {o.skills.slice(0, 4).map((s) => (
                        <span key={s.id} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ocard-meta">
                    <span className="m">{o.domain}</span>
                    <span className="m">{stipendLabel(o.stipend, o.stipendAmount)}</span>
                    <span className="m">{o.seatCount - o.seatsFilled} of {o.seatCount} seats</span>
                    <span className="m">{closesLabel(o.deadline)}</span>
                    <span className="m">{slaLabel(o.slaPledge)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {cursor && (
            <div className="load-more">
              <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void fetchPage(false)}>
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
