"use client";

import { useEffect, useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { NavIcon } from "@/components/nav-icon";
import { apiAdminListUsers, apiAdminUpdateUser, ApiError, type AdminUser } from "@/lib/client/api";
import { dateLabel } from "@/lib/client/format";
import { initials, roleLabel } from "@/lib/client/nav";
import { isAdminRole } from "@/lib/domain/admin-portal";

const ROLES = ["STUDENT", "FACULTY", "ALUMNI"] as const;
type MemberRole = (typeof ROLES)[number];

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "STUDENT", label: "Students" },
  { value: "FACULTY", label: "Faculty" },
  { value: "ALUMNI", label: "Alumni" },
];

/** Search members, change a role, and (super admin) suspend or restore an account. */
export function AdminUsersPanel({
  isSuper,
  onNotice,
  onError,
}: {
  isSuper: boolean;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Search as you type, debounced so each keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => {
      apiAdminListUsers({ q: q.trim() || undefined, role: role || undefined, status: suspendedOnly ? "SUSPENDED" : undefined })
        .then(setUsers)
        .catch((e: unknown) => onError(e instanceof ApiError ? e.message : "Could not load users."));
    }, 250);
    return () => clearTimeout(t);
  }, [q, role, suspendedOnly, onError]);

  async function change(u: AdminUser, patch: { role?: MemberRole; status?: "ACTIVE" | "SUSPENDED" }) {
    setBusyId(u.id);
    try {
      const updated = await apiAdminUpdateUser(u.id, patch);
      setUsers((prev) => prev?.map((x) => (x.id === u.id ? updated : x)) ?? null);
      onNotice(
        patch.status === "SUSPENDED" ? `${u.name} is suspended and can no longer use the portal.`
          : patch.status === "ACTIVE" ? `${u.name} is restored.`
            : `${u.name} is now ${roleLabel(updated.role).toLowerCase()}.`,
      );
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-stack">
      <div className="applicant-toolbar">
        <div className="search-input">
          <NavIcon name="search" size={16} />
          <label htmlFor="user-search" className="sr-only">Search name or email</label>
          <input id="user-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
        </div>
      </div>
      <div className="stage-tabs" role="group" aria-label="Filter members">
        {ROLE_FILTERS.map((r) => (
          <button key={r.value} type="button" className={`chip${role === r.value ? " is-on" : ""}`}
            aria-pressed={role === r.value} onClick={() => setRole(r.value)}>
            {r.label}
          </button>
        ))}
        <button type="button" className={`chip${suspendedOnly ? " is-on" : ""}`} aria-pressed={suspendedOnly}
          onClick={() => setSuspendedOnly((v) => !v)}>
          Suspended only
        </button>
      </div>

      {!users ? (
        <div className="skeleton skeleton-card" aria-busy="true" />
      ) : users.length === 0 ? (
        <div className="empty-card"><h3>No one matches</h3><p>Try another name, email or filter.</p></div>
      ) : (
        <ul className="adm-list">
          {users.map((u) => {
            const admin = isAdminRole(u.role);
            const suspended = u.status === "SUSPENDED";
            return (
              <li key={u.id} className={`adm-row${suspended ? " is-muted" : ""}`}>
                <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                <div className="adm-row-main">
                  <span className="adm-row-title">{u.name}</span>
                  <span className="adm-row-meta">{u.email} · joined {dateLabel(u.createdAt)}</span>
                </div>
                <div className="adm-row-actions">
                  {suspended && <span className="stage-pill s-rejected">Suspended</span>}
                  {u.status !== "ACTIVE" && !suspended && <span className="stage-pill">{u.status.toLowerCase()}</span>}
                  {admin ? (
                    <span className="stage-pill s-shortlisted">{roleLabel(u.role)}</span>
                  ) : (
                    <label className="toolbar-field role-field">
                      <span className="sr-only">Role for {u.name}</span>
                      <select value={u.role} disabled={busyId === u.id}
                        onChange={(e) => void change(u, { role: e.target.value as MemberRole })}>
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    </label>
                  )}
                  {!admin && isSuper && (suspended ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === u.id}
                      onClick={() => void change(u, { status: "ACTIVE" })}>
                      Restore
                    </button>
                  ) : (
                    <ConfirmAction danger label="Suspend" question="Block their access to the portal?" confirmLabel="Suspend"
                      busy={busyId === u.id} onConfirm={() => void change(u, { status: "SUSPENDED" })} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
