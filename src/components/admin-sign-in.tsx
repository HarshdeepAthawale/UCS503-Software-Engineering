"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  apiLogin,
  apiRequestLoginOtp,
  apiVerifyLoginOtp,
  ApiError,
  type SessionUser,
} from "@/lib/client/api";
import { AuthShell } from "@/components/auth-shell";
import { TiLogo } from "@/components/ti-logo";

type View = "password" | "code";

/**
 * The admin door (/admin, signed out). Admin accounts can sign in only here -
 * the server refuses them on the main page - and there is no Google option:
 * admins are often not on the institute domain. New admins have no password
 * yet and use the emailed one-time code.
 */
export function AdminSignIn({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [view, setView] = useState<View>("password");
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => onSignedIn(await apiLogin(email.trim(), password, "admin")), "Could not sign in.");
  };

  const onRequestCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiRequestLoginOtp(email.trim(), "admin");
      setCodeSent(true);
      setNotice("If that is an admin account, a sign-in code has been sent to it.");
    }, "Could not send a code.");
  };

  const onVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    void run(
      async () => onSignedIn(await apiVerifyLoginOtp(email.trim(), otp.trim(), "admin")),
      "Invalid or expired code.",
    );
  };

  function go(next: View) {
    setView(next);
    setCodeSent(false);
    setOtp("");
    setError(null);
    setNotice(null);
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <TiLogo size={48} className="auth-logo" priority />
        <p className="auth-eyebrow">Admin Console</p>
        <h1>Thapar Nexus</h1>
        <p className="sub">
          {view === "password"
            ? "Sign in with your administrator account."
            : "We'll email a one-time code to your admin address."}
        </p>

        {error && <p className="form-err" role="alert">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}

        {view === "password" && (
          <form className="form" onSubmit={onPassword} noValidate>
            <div className="field">
              <label htmlFor="aemail">Email</label>
              <input id="aemail" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="apassword">Password</label>
              <input id="apassword" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {view === "code" && !codeSent && (
          <form className="form" onSubmit={onRequestCode} noValidate>
            <div className="field">
              <label htmlFor="acemail">Email</label>
              <input id="acemail" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        )}

        {view === "code" && codeSent && (
          <form className="form" onSubmit={onVerifyCode} noValidate>
            <div className="field">
              <label htmlFor="aotp">6-digit code</label>
              <input id="aotp" type="text" inputMode="numeric" autoComplete="one-time-code" required
                maxLength={6} pattern="\d{6}" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Sign in"}
            </button>
          </form>
        )}

        <div className="auth-foot">
          {view === "password" ? (
            <button className="btn btn-ghost" type="button" onClick={() => go("code")}>
              Email me a code
            </button>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={() => go("password")}>
              Use a password
            </button>
          )}
          <Link className="btn btn-ghost" href="/">Member sign-in</Link>
        </div>
      </div>
    </AuthShell>
  );
}
