"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListNotifications,
  apiListOpportunities,
  ApiError,
  bootstrapSession,
  getUser,
  type Opportunity,
  type OppType,
} from "@/lib/client/api";
import { deadlineLabel, oppTypeLabel, slaLabel, statusClass, titleCase } from "@/lib/client/format";

const TYPES: OppType[] = [
  "RESEARCH",
  "INTERNSHIP",
  "TA",
  "HACKATHON_TEAM",
  "MICRO_TASK",
  "REFERRAL",
];

export default function OpportunitiesPage() {
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
          cursor: reset ? undefined : cursor ?? undefined,
        });
        setItems((prev) => (reset ? res.opportunities : [...prev, ...res.opportunities]));
        setCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load opportunities.");
      } finally {
        setLoading(false);
      }
    },
    [q, type, domain, stipend, cursor],
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
  }, [signedIn, q, type, domain, stipend]);

  if (!ready) {
    return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  }
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <p className="sub">Sign in to browse opportunities.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
            <Link className="btn btn-ghost" href="/register">Create account</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} unread={unread} />
      <main className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>Opportunities</h1>
              <p className="sub">Research, internships, TA roles and more — every posting SLA-pledged.</p>
            </div>
          </div>

          <div className="facet-bar">
            <input
              type="search"
              placeholder="Search titles & descriptions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search opportunities"
            />
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Type">
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{oppTypeLabel(t)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Domain (e.g. ML)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-label="Domain"
            />
            <select value={stipend} onChange={(e) => setStipend(e.target.value as typeof stipend)} aria-label="Stipend">
              <option value="">Any stipend</option>
              <option value="true">Stipend</option>
              <option value="false">Unpaid</option>
            </select>
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
                  <p className="desc">{o.description}</p>
                  {o.skills.length > 0 && (
                    <div className="tagrow" style={{ marginBottom: 12 }}>
                      {o.skills.slice(0, 4).map((s) => (
                        <span key={s.id} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ocard-meta">
                    <span className="m">{o.domain}</span>
                    <span className="m">{o.stipend ? "Stipend" : "Unpaid"}</span>
                    <span className="m">{o.seatCount - o.seatsFilled} of {o.seatCount} seats</span>
                    <span className="m">Closes {deadlineLabel(o.deadline)}</span>
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
