"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { NavIcon } from "@/components/nav-icon";
import {
  apiAdminAddAllowlist,
  apiAdminCreateAdmin,
  apiAdminListAdmins,
  apiAdminListAllowlist,
  apiAdminProvisionAlumni,
  apiAdminRemoveAdmin,
  apiAdminRemoveAllowlist,
  ApiError,
  type AdminUser,
  type AllowlistEntry,
} from "@/lib/client/api";
import { dateLabel, timeAgo } from "@/lib/client/format";
import { initials } from "@/lib/client/nav";

interface Feedback {
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Emails promoted to Faculty on their next sign-in. Editing it is the super admin's. */
export function AdminFacultyPanel({ isSuper, onNotice, onError }: Feedback & { isSuper: boolean }) {
  const [entries, setEntries] = useState<AllowlistEntry[] | null>(null);
  const [filter, setFilter] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await apiAdminListAllowlist());
    } catch (e) {
      onError(message(e, "Could not load the faculty roster."));
    }
  }, [onError]);

  useEffect(() => void load(), [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiAdminAddAllowlist(email.trim(), note.trim() || undefined);
      onNotice(`${email.trim()} will be faculty on their next sign-in.`);
      setEmail("");
      setNote("");
      await load();
    } catch (err) {
      onError(message(err, "Could not add the email."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: AllowlistEntry) {
    try {
      await apiAdminRemoveAllowlist(entry.id);
      onNotice(`${entry.email} removed from the roster.`);
      await load();
    } catch (e) {
      onError(message(e, "Could not remove the email."));
    }
  }

  const f = filter.trim().toLowerCase();
  const shown = entries?.filter((x) => !f || x.email.toLowerCase().includes(f) || (x.note ?? "").toLowerCase().includes(f)) ?? [];

  return (
    <div className={isSuper ? "adm-split" : ""}>
      <section className="card section-card">
        <header>
          <h2>Faculty roster {entries && <span className="count">{entries.length}</span>}</h2>
          <p>These emails become Faculty on their next sign-in.</p>
        </header>
        {entries && entries.length > 6 && (
          <div className="search-input adm-filter">
            <NavIcon name="search" size={16} />
            <label htmlFor="roster-filter" className="sr-only">Filter the roster</label>
            <input id="roster-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by email or note" />
          </div>
        )}
        {!entries ? (
          <div className="skeleton skeleton-card" aria-busy="true" />
        ) : shown.length === 0 ? (
          <p className="muted-note">{entries.length === 0 ? "No faculty emails yet." : "No email matches."}</p>
        ) : (
          <ul className="adm-plain-list">
            {shown.map((x) => (
              <li key={x.id}>
                <div className="adm-row-main">
                  <span className="adm-row-title">{x.email}</span>
                  <span className="adm-row-meta">{x.note ? `${x.note} · ` : ""}added {timeAgo(x.createdAt)}</span>
                </div>
                {isSuper && (
                  <ConfirmAction danger label="Remove" question="Remove from the roster?" confirmLabel="Remove"
                    onConfirm={() => void remove(x)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isSuper && (
        <section className="card section-card adm-form-card">
          <header><h2>Add a faculty email</h2></header>
          <form className="form" onSubmit={(e) => void add(e)}>
            <div className="field">
              <label htmlFor="fl-email">Institute email</label>
              <input id="fl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@thapar.edu" />
            </div>
            <div className="field">
              <label htmlFor="fl-note">Note <span className="optional">optional</span></label>
              <input id="fl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. CSED, Associate Professor" maxLength={200} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add to roster"}</button>
          </form>
        </section>
      )}
    </div>
  );
}

const EMPTY_ALUMNI = { name: "", email: "", rollNo: "", gradYear: "", degree: "", proofUrl: "" };

/** Alumni cannot self-register (their institute email is revoked), so an admin creates the account. */
export function AdminAlumniPanel({ onNotice, onError }: Feedback) {
  const [al, setAl] = useState(EMPTY_ALUMNI);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY_ALUMNI) => (e: { target: { value: string } }) => setAl((p) => ({ ...p, [k]: e.target.value }));

  async function provision(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiAdminProvisionAlumni({
        name: al.name.trim(),
        email: al.email.trim(),
        rollNo: al.rollNo.trim() || undefined,
        gradYear: al.gradYear ? Number(al.gradYear) : undefined,
        degree: al.degree.trim() || undefined,
        proofUrl: al.proofUrl.trim() || undefined,
      });
      onNotice(`${al.name.trim()}'s alumni account is ready. They sign in with a one-time code.`);
      setAl(EMPTY_ALUMNI);
    } catch (err) {
      onError(message(err, "Could not create the account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card section-card adm-form-wide">
      <header>
        <h2>Create an alumni account</h2>
        <p>Check their proof first. They use a personal email and sign in with a one-time code.</p>
      </header>
      <form className="form" onSubmit={(e) => void provision(e)}>
        <div className="adm-form-grid">
          <div className="field">
            <label htmlFor="al-name">Full name</label>
            <input id="al-name" required value={al.name} onChange={set("name")} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="al-email">Personal email</label>
            <input id="al-email" type="email" required value={al.email} onChange={set("email")} placeholder="name@gmail.com" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="al-roll">Roll number <span className="optional">optional</span></label>
            <input id="al-roll" value={al.rollNo} onChange={set("rollNo")} />
          </div>
          <div className="field">
            <label htmlFor="al-year">Graduation year <span className="optional">optional</span></label>
            <input id="al-year" type="number" inputMode="numeric" min={1956} max={new Date().getFullYear()} value={al.gradYear} onChange={set("gradYear")} />
          </div>
          <div className="field">
            <label htmlFor="al-degree">Degree <span className="optional">optional</span></label>
            <input id="al-degree" value={al.degree} onChange={set("degree")} placeholder="e.g. B.E. Computer Engineering" />
          </div>
          <div className="field">
            <label htmlFor="al-proof">Proof link <span className="optional">optional</span></label>
            <input id="al-proof" type="url" value={al.proofUrl} onChange={set("proofUrl")} placeholder="Degree certificate or LinkedIn" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </div>
      </form>
    </section>
  );
}

/** The super admin's own list: who runs the console. */
export function AdminAdminsPanel({ onNotice, onError }: Feedback) {
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAdmins(await apiAdminListAdmins());
    } catch (e) {
      onError(message(e, "Could not load admins."));
    }
  }, [onError]);

  useEffect(() => void load(), [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const a = await apiAdminCreateAdmin(form.name.trim(), form.email.trim());
      setForm({ name: "", email: "" });
      await load();
      onNotice(
        a.invited
          ? `${a.name} is an admin and has been emailed how to sign in.`
          : `${a.name} is an admin, but the email did not send. Ask them to open /admin and choose "Email me a code".`,
      );
    } catch (err) {
      onError(message(err, "Could not add the admin."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: AdminUser) {
    try {
      await apiAdminRemoveAdmin(a.id);
      await load();
      onNotice(`${a.name} is no longer an admin.`);
    } catch (e) {
      onError(message(e, "Could not remove the admin."));
    }
  }

  return (
    <div className="adm-split">
      <section className="card section-card">
        <header>
          <h2>Admins {admins && <span className="count">{admins.length}</span>}</h2>
          <p>Only you, the super admin, can add or remove them.</p>
        </header>
        {!admins ? (
          <div className="skeleton skeleton-card" aria-busy="true" />
        ) : (
          <ul className="adm-plain-list">
            {admins.map((a) => (
              <li key={a.id}>
                <span className="avatar" aria-hidden="true">{initials(a.name)}</span>
                <div className="adm-row-main">
                  <span className="adm-row-title">{a.name}</span>
                  <span className="adm-row-meta">{a.email} · since {dateLabel(a.createdAt)}</span>
                </div>
                {a.role === "SUPER_ADMIN" ? (
                  <span className="stage-pill s-selected">Super admin</span>
                ) : (
                  <ConfirmAction danger label="Remove" question="Close their account and sign them out?" confirmLabel="Remove"
                    onConfirm={() => void remove(a)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section-card adm-form-card">
        <header>
          <h2>Add an admin</h2>
          <p>They get an email with a link to /admin and sign in with a one-time code. No password is shared.</p>
        </header>
        <form className="form" onSubmit={(e) => void create(e)}>
          <div className="field">
            <label htmlFor="ad-name">Full name</label>
            <input id="ad-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="ad-email">Email</label>
            <input id="ad-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add admin"}</button>
        </form>
      </section>
    </div>
  );
}
