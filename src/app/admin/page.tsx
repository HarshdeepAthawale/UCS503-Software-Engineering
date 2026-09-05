"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiAdminAddAllowlist,
  apiAdminAnalytics,
  apiAdminListAllowlist,
  apiAdminListFlags,
  apiAdminListUsers,
  apiAdminOverview,
  apiAdminProvisionAlumni,
  apiAdminRemoveAllowlist,
  apiAdminResolveFlag,
  apiAdminUpdateUser,
  ApiError,
  bootstrapSession,
  getUser,
  type AdminFlag,
  type AdminOverview,
  type AdminUser,
  type AllowlistEntry,
  type InstituteAnalytics,
} from "@/lib/client/api";
import { timeAgo, titleCase } from "@/lib/client/format";

type Tab = "overview" | "users" | "faculty" | "alumni" | "flags" | "analytics";

/** A labelled horizontal bar row, scaled to the largest value in its group. */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-val">{value}</span>
    </div>
  );
}

function BarGroup({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="panel">
      <h2 style={{ fontSize: 15, marginTop: 0 }}>{title}</h2>
      <div className="bar-list">
        {entries.map(([k, v]) => (
          <BarRow key={k} label={titleCase(k)} value={v} max={max} />
        ))}
      </div>
    </div>
  );
}
const ROLES = ["STUDENT", "FACULTY", "ALUMNI"] as const;

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [analytics, setAnalytics] = useState<InstituteAnalytics | null>(null);

  const [flEmail, setFlEmail] = useState("");
  const [flNote, setFlNote] = useState("");
  const [al, setAl] = useState({ name: "", email: "", rollNo: "", gradYear: "", degree: "", proofUrl: "" });

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setAllowed(ok && getUser()?.role === "ADMIN");
      setReady(true);
      if (ok && getUser()?.role === "ADMIN") {
        try {
          setOverview(await apiAdminOverview());
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Failed to load.");
        }
      }
    })();
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await apiAdminListUsers({ q: q.trim() || undefined, role: roleFilter || undefined }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load users.");
    }
  }, [q, roleFilter]);

  const loadAllowlist = useCallback(async () => {
    try {
      setAllowlist(await apiAdminListAllowlist());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load allowlist.");
    }
  }, []);

  const loadFlags = useCallback(async () => {
    try {
      setFlags(await apiAdminListFlags());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load the flag queue.");
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await apiAdminAnalytics());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load analytics.");
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await apiAdminOverview());
    } catch {
      /* overview is a nicety here; ignore a refresh failure */
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    if (tab === "users") void loadUsers();
    if (tab === "faculty") void loadAllowlist();
    if (tab === "flags") void loadFlags();
    if (tab === "analytics") void loadAnalytics();
  }, [allowed, tab, loadUsers, loadAllowlist, loadFlags, loadAnalytics]);

  async function resolveFlag(
    f: AdminFlag,
    decision: "RESOLVED" | "DISMISSED",
    removePosting = false,
  ) {
    setError(null);
    try {
      await apiAdminResolveFlag(f.id, { decision, removePosting });
      await Promise.all([loadFlags(), refreshOverview()]);
      flash(
        removePosting
          ? "Flag upheld and posting removed."
          : decision === "RESOLVED"
            ? "Flag upheld."
            : "Flag dismissed.",
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the flag.");
    }
  }

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 3000);
  }

  async function changeUser(u: AdminUser, patch: { role?: (typeof ROLES)[number]; status?: "ACTIVE" | "SUSPENDED" }) {
    setError(null);
    try {
      const updated = await apiAdminUpdateUser(u.id, patch);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      flash("User updated.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed.");
    }
  }

  async function addAllowlist(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiAdminAddAllowlist(flEmail.trim(), flNote.trim() || undefined);
      setFlEmail("");
      setFlNote("");
      await loadAllowlist();
      flash("Added to faculty allowlist.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add.");
    }
  }

  async function removeAllow(id: string) {
    try {
      await apiAdminRemoveAllowlist(id);
      await loadAllowlist();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiAdminProvisionAlumni({
        name: al.name.trim(),
        email: al.email.trim(),
        rollNo: al.rollNo.trim() || undefined,
        gradYear: al.gradYear ? Number(al.gradYear) : undefined,
        degree: al.degree.trim() || undefined,
        proofUrl: al.proofUrl.trim() || undefined,
      });
      setAl({ name: "", email: "", rollNo: "", gradYear: "", degree: "", proofUrl: "" });
      flash("Alumni account provisioned. They can now sign in with a code.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not provision.");
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
  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main id="content" className="app-page"><div className="wrap app-empty">
          <h3>Administrators only</h3>
          <p>This console is restricted to the platform administrator.</p>
          <Link className="btn btn-ghost" href="/opportunities">← Back to app</Link>
        </div></main>
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
              <h1>Admin console</h1>
              <p className="sub">Govern identity, roles, and the faculty roster. Every action is audited.</p>
            </div>
          </div>

          <div className="tabs">
            {(["overview", "analytics", "users", "faculty", "alumni", "flags"] as Tab[]).map((t) => (
              <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t === "alumni"
                  ? "Provision alumni"
                  : t === "flags"
                    ? `Flags${overview?.openFlags ? ` (${overview.openFlags})` : ""}`
                    : titleCase(t)}
              </button>
            ))}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}
          {notice && <p className="form-ok">{notice}</p>}

          {tab === "overview" && overview && (
            <div className="stat-grid">
              <div className="stat"><span className="n">{overview.users.STUDENT ?? 0}</span><span className="l">Students</span></div>
              <div className="stat"><span className="n">{overview.users.FACULTY ?? 0}</span><span className="l">Faculty</span></div>
              <div className="stat"><span className="n">{overview.users.ALUMNI ?? 0}</span><span className="l">Alumni</span></div>
              <div className="stat"><span className="n">{overview.opportunities.live}</span><span className="l">Live postings</span></div>
              <div className="stat"><span className="n">{overview.opportunities.atRisk}</span><span className="l">At-risk postings</span></div>
              <div className="stat"><span className="n">{overview.applications}</span><span className="l">Applications</span></div>
              <div className="stat"><span className="n">{overview.pendingClaims}</span><span className="l">Pending claims</span></div>
              <div className="stat"><span className="n">{overview.openFlags}</span><span className="l">Open flags</span></div>
            </div>
          )}

          {tab === "users" && (
            <>
              <div className="facet-bar">
                <input type="search" placeholder="Search name or email…" value={q}
                  onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadUsers(); }} />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="">All roles</option>
                  {["STUDENT", "FACULTY", "ALUMNI", "ADMIN"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void loadUsers()}>Search</button>
              </div>
              <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
                <table className="atable">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map((u) => {
                      const isAdmin = u.role === "ADMIN";
                      return (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td className="mono-cell">{u.email}</td>
                          <td>
                            {isAdmin ? <span className="tag">Admin</span> : (
                              <select value={u.role} onChange={(e) => void changeUser(u, { role: e.target.value as (typeof ROLES)[number] })}>
                                {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                              </select>
                            )}
                          </td>
                          <td><span className={`pill ${u.status === "SUSPENDED" ? "p-rejected" : u.status === "ACTIVE" ? "p-live" : "p-draft"}`}>{titleCase(u.status)}</span></td>
                          <td>
                            {!isAdmin && (u.status === "SUSPENDED"
                              ? <button className="mini solid" onClick={() => void changeUser(u, { status: "ACTIVE" })}>Reactivate</button>
                              : <button className="mini" onClick={() => void changeUser(u, { status: "SUSPENDED" })}>Suspend</button>)}
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && <tr><td colSpan={5} className="empty-note" style={{ padding: 20 }}>No users match.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "faculty" && (
            <div className="detail-grid">
              <div className="panel">
                <h2 style={{ fontSize: 16, marginTop: 0 }}>Faculty roster</h2>
                <p className="empty-note" style={{ marginBottom: 14 }}>
                  Emails here are promoted to FACULTY on their next sign-in. Pre-load the roster before deployment.
                </p>
                <div className="notif-list">
                  {allowlist.map((e) => (
                    <div key={e.id} className="notif">
                      <span className="body">
                        <span className="t">{e.email}</span>
                        <span className="when">{e.note ? `${e.note} · ` : ""}added {timeAgo(e.createdAt)}</span>
                      </span>
                      <button className="mini" onClick={() => void removeAllow(e.id)}>Remove</button>
                    </div>
                  ))}
                  {allowlist.length === 0 && <p className="empty-note">No faculty emails yet.</p>}
                </div>
              </div>
              <div className="panel">
                <h2 style={{ fontSize: 16, marginTop: 0 }}>Add professor email</h2>
                <form className="form" onSubmit={addAllowlist}>
                  <div className="field"><label htmlFor="fle">Institute email</label>
                    <input id="fle" type="email" required value={flEmail} onChange={(e) => setFlEmail(e.target.value)} placeholder="prof@thapar.edu" /></div>
                  <div className="field"><label htmlFor="fln">Note (optional)</label>
                    <input id="fln" value={flNote} onChange={(e) => setFlNote(e.target.value)} placeholder="e.g. CSED, Prof." maxLength={200} /></div>
                  <button className="btn btn-primary" type="submit">Add to allowlist</button>
                </form>
              </div>
            </div>
          )}

          {tab === "alumni" && (
            <div className="panel" style={{ maxWidth: 560 }}>
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Provision an alumni account</h2>
              <p className="empty-note" style={{ marginBottom: 14 }}>
                Alumni can't self-register (revoked institute email). Create their account with a personal email after
                verifying proof - they'll sign in with a one-time code.
              </p>
              <form className="form" onSubmit={provision}>
                <div className="field"><label htmlFor="an">Full name</label>
                  <input id="an" required value={al.name} onChange={(e) => setAl({ ...al, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="ae">Personal email</label>
                  <input id="ae" type="email" required value={al.email} onChange={(e) => setAl({ ...al, email: e.target.value })} placeholder="name@gmail.com" /></div>
                <div className="field"><label htmlFor="ar">Roll number (proof)</label>
                  <input id="ar" value={al.rollNo} onChange={(e) => setAl({ ...al, rollNo: e.target.value })} /></div>
                <div className="field"><label htmlFor="ag">Graduation year</label>
                  <input id="ag" type="number" value={al.gradYear} onChange={(e) => setAl({ ...al, gradYear: e.target.value })} /></div>
                <div className="field"><label htmlFor="ad">Degree</label>
                  <input id="ad" value={al.degree} onChange={(e) => setAl({ ...al, degree: e.target.value })} placeholder="e.g. B.E. Computer Science" /></div>
                <div className="field"><label htmlFor="ap">Proof URL (certificate / LinkedIn)</label>
                  <input id="ap" value={al.proofUrl} onChange={(e) => setAl({ ...al, proofUrl: e.target.value })} placeholder="https://…" /></div>
                <button className="btn btn-primary" type="submit">Provision alumni</button>
              </form>
            </div>
          )}

          {tab === "flags" && (
            <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr><th>Posting</th><th>Poster</th><th>Reason</th><th>Reported by</th><th>When</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/opportunities/${f.opportunity.id}`}>
                          {f.opportunity.title}
                        </Link>
                        {f.detail && <div className="empty-note" style={{ marginTop: 4 }}>{f.detail}</div>}
                      </td>
                      <td>{f.opportunity.poster.name}</td>
                      <td><span className="tag">{titleCase(f.reason)}</span></td>
                      <td>{f.reporter.name}</td>
                      <td className="mono-cell">{timeAgo(f.createdAt)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="mini" onClick={() => void resolveFlag(f, "DISMISSED")}>Dismiss</button>
                          <button className="mini solid" onClick={() => void resolveFlag(f, "RESOLVED")}>Uphold</button>
                          <button
                            className="mini"
                            onClick={() => {
                              if (confirm(`Remove the posting "${f.opportunity.title}"? This hides it from all listings.`))
                                void resolveFlag(f, "RESOLVED", true);
                            }}
                          >
                            Uphold + remove posting
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {flags.length === 0 && (
                    <tr><td colSpan={6} className="empty-note" style={{ padding: 20 }}>No open flags. The queue is clear.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "analytics" && (
            !analytics ? (
              <p className="app-loading">Loading analytics…</p>
            ) : (
              <div className="analytics">
                <div className="stat-grid">
                  <div className="stat"><span className="n">{analytics.applications.total}</span><span className="l">Applications</span></div>
                  <div className="stat"><span className="n">{pctText(analytics.applications.resolutionRate)}</span><span className="l">Resolution rate</span></div>
                  <div className="stat"><span className="n">{analytics.applications.medianTtaHours == null ? "—" : `${analytics.applications.medianTtaHours}h`}</span><span className="l">Median TTA</span></div>
                  <div className="stat"><span className="n">{pctText(analytics.seats.fillRate)}</span><span className="l">Seat fill rate</span></div>
                  <div className="stat"><span className="n">{analytics.applications.acknowledged}</span><span className="l">Acknowledged</span></div>
                  <div className="stat"><span className="n">{analytics.seats.filled}/{analytics.seats.total}</span><span className="l">Seats filled</span></div>
                </div>

                <div className="panel" style={{ marginTop: 20 }}>
                  <h2 style={{ fontSize: 15, marginTop: 0 }}>Applications — last 14 days</h2>
                  <div className="spark" role="img" aria-label="Applications per day, last 14 days">
                    {(() => {
                      const max = Math.max(1, ...analytics.perDay.map((d) => d.count));
                      return analytics.perDay.map((d) => (
                        <span key={d.day} className="spark-col" title={`${d.day}: ${d.count}`}>
                          <span
                            className="spark-bar"
                            style={{ height: `${Math.round((d.count / max) * 100)}%` }}
                          />
                        </span>
                      ));
                    })()}
                  </div>
                  <p className="empty-note" style={{ marginTop: 8 }}>
                    {analytics.perDay.reduce((s, d) => s + d.count, 0)} applications in this window.
                  </p>
                </div>

                <div className="detail-grid" style={{ marginTop: 20 }}>
                  <BarGroup title="Applications by stage" data={analytics.byAppState} />
                  <BarGroup title="Postings by type" data={analytics.byOppType} />
                </div>
                <div className="detail-grid" style={{ marginTop: 20 }}>
                  <BarGroup title="Postings by status" data={analytics.byOppStatus} />
                </div>

                <p className="empty-note" style={{ marginTop: 16 }}>
                  Figures derive from the immutable application event log — TTA and resolution
                  rate cannot be back-dated or self-reported.
                </p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

/** Render a 0..1 ratio as a whole-percent string. */
function pctText(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
