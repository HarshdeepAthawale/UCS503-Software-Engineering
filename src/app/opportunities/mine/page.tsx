"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiCloseOpportunity,
  apiListOpportunities,
  ApiError,
  bootstrapSession,
  getUser,
  type Opportunity,
} from "@/lib/client/api";
import { closesLabel, oppTypeLabel, statusClass, titleCase } from "@/lib/client/format";

/**
 * "My Postings" - a faculty/alumni dashboard of everything THEY have posted,
 * any status (live, expired, closed), in one place. Before this page the only
 * way to find your own posting was to filter/scroll the public feed, which
 * hides expired postings entirely - so a poster had no way to review their
 * own history. `GET /api/opportunities?mine=true` resolves the poster id from
 * the session server-side; nothing here can list anyone else's postings.
 */
export default function MyPostingsPage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiListOpportunities({ mine: "true", sort: "recent", limit: 100 });
      setItems(res.opportunities);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your postings.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      const role = getUser()?.role;
      const canPost = ok && (role === "FACULTY" || role === "ALUMNI");
      setAllowed(canPost);
      setReady(true);
      if (canPost) await load();
    })();
  }, [load]);

  async function close(id: string) {
    if (!confirm("Close this posting? It stops accepting applications immediately.")) return;
    setError(null);
    setBusyId(id);
    try {
      await apiCloseOpportunity(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close this posting.");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;

  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page">
          <div className="wrap app-empty">
            <h3>Only faculty and approved alumni post opportunities</h3>
            <p>This dashboard lists what you've posted - students see everyone's postings on the feed.</p>
            <Link className="btn btn-ghost" href="/opportunities">← Back to feed</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>My postings</h1>
              <p className="sub">
                {items.length} posting{items.length === 1 ? "" : "s"} - every status, not just what's live.
              </p>
            </div>
            <Link className="btn btn-primary" href="/opportunities/new">+ Post</Link>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {items.length === 0 ? (
            <div className="app-empty">
              <h3>You haven't posted anything yet</h3>
              <Link className="btn btn-primary" href="/opportunities/new">Post an opportunity</Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Seats</th>
                    <th>Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/opportunities/${o.id}`}>{o.title}</Link></td>
                      <td>{oppTypeLabel(o.type)}</td>
                      <td><span className={`pill ${statusClass(o.status)}`}>{titleCase(o.status)}</span></td>
                      <td>{o.seatsFilled} of {o.seatCount}</td>
                      <td>{closesLabel(o.deadline)}</td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                          <Link className="mini solid" href={`/opportunities/${o.id}/applicants`}>Applicants</Link>
                          {(o.status === "LIVE" || o.status === "AT_RISK") && (
                            <>
                              <Link className="mini" href={`/opportunities/${o.id}/edit`}>Edit</Link>
                              <button
                                type="button"
                                className="mini"
                                disabled={busyId === o.id}
                                onClick={() => void close(o.id)}
                              >
                                Close
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
