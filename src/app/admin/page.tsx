"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { AdminSignIn } from "@/components/admin-sign-in";
import { AdminFlagsPanel } from "@/components/admin/admin-flags";
import { AdminOverviewPanel } from "@/components/admin/admin-overview";
import { AdminAdminsPanel, AdminAlumniPanel, AdminFacultyPanel } from "@/components/admin/admin-people-forms";
import { AdminUsersPanel } from "@/components/admin/admin-users";
import { apiAdminOverview, ApiError, bootstrapSession, getUser, type AdminOverview } from "@/lib/client/api";
import { adminTabs, parseAdminTab, type AdminTab } from "@/lib/client/admin";
import { isAdminRole } from "@/lib/domain/admin-portal";

/**
 * The admin console. /admin is the only door for admins. The super admin
 * alone manages admins, the faculty roster, suspensions and posting takedowns;
 * the API enforces that, the UI only hides what a regular admin would be
 * refused. The open tab lives in the URL (?tab=) so a refresh keeps it.
 */
export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await apiAdminOverview());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the console.");
    }
  }, []);

  const enter = useCallback(async () => {
    const user = getUser();
    const admin = !!user && isAdminRole(user.role);
    const sup = user?.role === "SUPER_ADMIN";
    setSignedIn(!!user);
    setAllowed(admin);
    setIsSuper(sup);
    setTab(parseAdminTab(new URLSearchParams(window.location.search).get("tab"), sup));
    setReady(true);
    if (admin) await refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    void bootstrapSession().then(() => enter());
  }, [enter]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const onNotice = useCallback((msg: string) => {
    setError(null);
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const onError = useCallback((msg: string) => {
    setNotice(null);
    setError(msg);
  }, []);

  function go(next: AdminTab) {
    setTab(next);
    setError(null);
    router.replace(next === "overview" ? "/admin" : `/admin?tab=${next}`, { scroll: false });
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) return <AdminSignIn onSignedIn={() => void enter()} />;

  const me = getUser();
  if (!allowed) {
    return (
      <div className="app-shell">
        <AppNav user={me} />
        <main id="content" className="app-page">
          <div className="wrap">
            <div className="empty-card">
              <h3>Administrators only</h3>
              <p>This console is for admin accounts. You are signed in as a member.</p>
              <Link className="btn btn-ghost" href="/opportunities">Back to opportunities</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="page-title-row">
            <div>
              <h1>Admin console</h1>
              <p className="sub">
                Signed in as {me?.name} · {isSuper ? "super admin" : "admin"}. Every action is recorded in the audit log.
              </p>
            </div>
          </div>

          <nav className="stage-tabs adm-tabs" aria-label="Console sections">
            {adminTabs(isSuper).map((t) => (
              <button key={t.value} type="button" className={`chip${tab === t.value ? " is-on" : ""}`}
                aria-current={tab === t.value ? "page" : undefined} onClick={() => go(t.value)}>
                {t.label}
                {t.value === "flags" && (overview?.openFlags ?? 0) > 0 && <span className="stage-count is-alert">{overview!.openFlags}</span>}
              </button>
            ))}
          </nav>

          {error && <p className="form-err" role="alert">{error}</p>}
          {notice && <p className="form-ok" role="status">{notice}</p>}

          {tab === "overview" && <AdminOverviewPanel overview={overview} onGo={go} onError={onError} />}
          {tab === "flags" && (
            <AdminFlagsPanel isSuper={isSuper} onChanged={() => void refreshOverview()} onNotice={onNotice} onError={onError} />
          )}
          {tab === "users" && <AdminUsersPanel isSuper={isSuper} onNotice={onNotice} onError={onError} />}
          {tab === "faculty" && <AdminFacultyPanel isSuper={isSuper} onNotice={onNotice} onError={onError} />}
          {tab === "alumni" && <AdminAlumniPanel onNotice={onNotice} onError={onError} />}
          {tab === "admins" && isSuper && <AdminAdminsPanel onNotice={onNotice} onError={onError} />}
        </div>
      </main>
    </div>
  );
}
