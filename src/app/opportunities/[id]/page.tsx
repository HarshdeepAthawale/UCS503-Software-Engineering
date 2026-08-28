"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiApply,
  apiCloseOpportunity,
  apiGetOpportunity,
  ApiError,
  bootstrapSession,
  getUser,
  type Opportunity,
} from "@/lib/client/api";
import {
  badgeLabel,
  deadlineLabel,
  oppTypeLabel,
  slaLabel,
  statusClass,
  titleCase,
  ttaLabel,
} from "@/lib/client/format";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOpp(await apiGetOpportunity(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this opportunity.");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) await load();
    })();
  }, [load]);

  async function onApply() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiApply(id, note.trim() || undefined);
      setNotice("Application submitted. Track it under Applications.");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply.");
    } finally {
      setBusy(false);
    }
  }

  async function onClose() {
    if (!confirm("Close this posting? Students can no longer apply.")) return;
    setBusy(true);
    try {
      await apiCloseOpportunity(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();
  const isOwner = !!opp && user?.id === opp.poster.id;
  const isStudent = user?.role === "STUDENT";
  const open = opp?.status === "LIVE" || opp?.status === "AT_RISK";
  const badge = opp?.poster.responsiveness?.badge;

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main className="app-page">
        <div className="wrap">
          <Link href="/opportunities" className="appnav-link" style={{ marginBottom: 16, display: "inline-flex" }}>
            ← Back to feed
          </Link>

          {error && <p className="form-err" role="alert">{error}</p>}
          {notice && <p className="form-ok">{notice}</p>}

          {!opp ? (
            <p className="app-loading">Loading…</p>
          ) : (
            <div className="detail-grid">
              <div className="panel detail-body">
                <div className="ocard-top" style={{ marginBottom: 4 }}>
                  <span className="ocard-type">{oppTypeLabel(opp.type)}</span>
                  <span className={`pill ${statusClass(opp.status)}`}>{titleCase(opp.status)}</span>
                </div>
                <h1>{opp.title}</h1>
                <p className="lede">{opp.description}</p>

                {opp.skills.length > 0 && (
                  <>
                    <h2 style={{ fontSize: 15, marginTop: 24, marginBottom: 10 }}>Skills</h2>
                    <div className="tagrow">
                      {opp.skills.map((s) => (
                        <span key={s.id} className={`tag${s.requirement === "REQUIRED" ? " req" : ""}`}>
                          {s.name} · {titleCase(s.requirement)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <aside className="panel">
                <div className="kv"><span className="k">Posted by</span><span className="v">{opp.poster.name}</span></div>
                <div className="kv"><span className="k">Domain</span><span className="v">{opp.domain}</span></div>
                <div className="kv"><span className="k">Stipend</span><span className="v">{opp.stipend ? "Yes" : "No"}</span></div>
                {opp.duration && <div className="kv"><span className="k">Duration</span><span className="v">{opp.duration}</span></div>}
                <div className="kv"><span className="k">Seats</span><span className="v">{opp.seatCount - opp.seatsFilled} of {opp.seatCount} open</span></div>
                <div className="kv"><span className="k">Deadline</span><span className="v">Closes {deadlineLabel(opp.deadline)}</span></div>
                <div className="kv"><span className="k">SLA pledge</span><span className="v">{slaLabel(opp.slaPledge)}</span></div>
                {badge && (
                  <div className="kv">
                    <span className="k">Responsiveness</span>
                    <span className="v">
                      <span className={`rbadge b-${badge.toLowerCase()}`}>{badgeLabel(badge)}</span>
                    </span>
                  </div>
                )}
                {badge && opp.poster.responsiveness?.medianTtaHours != null && (
                  <div className="kv"><span className="k">Median reply</span><span className="v">{ttaLabel(opp.poster.responsiveness.medianTtaHours)}</span></div>
                )}

                <div style={{ marginTop: 18 }}>
                  {isOwner ? (
                    <div className="hero-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <Link className="btn btn-primary" href={`/opportunities/${id}/applicants`}>Manage applicants</Link>
                      <Link className="btn btn-ghost" href={`/opportunities/${id}/edit`}>Edit posting</Link>
                      {opp.status !== "CLOSED" && opp.status !== "EXPIRED" && (
                        <button className="btn btn-danger" type="button" onClick={onClose} disabled={busy}>Close posting</button>
                      )}
                    </div>
                  ) : isStudent && open ? (
                    <div className="form">
                      <div className="field">
                        <label htmlFor="note">Add a short note (optional)</label>
                        <textarea id="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Why you're a fit…" />
                      </div>
                      <button className="btn btn-primary" type="button" onClick={onApply} disabled={busy}>
                        {busy ? "Submitting…" : "Apply now"}
                      </button>
                    </div>
                  ) : isStudent ? (
                    <p className="empty-note">This posting is not accepting applications.</p>
                  ) : (
                    <p className="empty-note">Only students can apply to opportunities.</p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
