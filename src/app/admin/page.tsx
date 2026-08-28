"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiAdminAddAllowlist,
  apiAdminListAllowlist,
  apiAdminListUsers,
  apiAdminOverview,
  apiAdminProvisionAlumni,
  apiAdminRemoveAllowlist,
  apiAdminUpdateUser,
  ApiError,
  bootstrapSession,
  getUser,
  type AdminOverview,
  type AdminUser,
  type AllowlistEntry,
} from "@/lib/client/api";
import { timeAgo, titleCase } from "@/lib/client/format";

type Tab = "overview" | "users" | "faculty" | "alumni";
const ROLES = ["STUDENT", "FACULTY", "ALUMNI"] as const;

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);

  const [flEmail, setFlEmail] = useState("");
  const [flNote, setFlNote] = useState("");
  const [al, setAl] = useState({ name: "", email: "", rollNo: "", gradYear: "", degree: "", proofUrl: "" });

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
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

  useEffect(() => {
    if (!allowed) return;
    if (tab === "users") void loadUsers();
    if (tab === "faculty") void loadAllowlist();
  }, [allowed, tab, loadUsers, loadAllowlist]);

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
  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={getUser()} />
        <main className="app-page"><div className="wrap app-empty">
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
      <main className="app-page">
        <div className="wrap">
          <div className="page-head">
            <div>
              <h1>Admin console</h1>
              <p className="sub">Govern identity, roles, and the faculty roster. Every action is audited.</p>
            </div>
          </div>

          <div className="tabs">
            {(["overview", "users", "faculty", "alumni"] as Tab[]).map((t) => (
              <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t === "alumni" ? "Provision alumni" : titleCase(t)}
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
        </div>
      </main>
    </div>
  );
}
