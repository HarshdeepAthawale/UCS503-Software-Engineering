"use client";

import { useState, type FormEvent } from "react";
import { apiRequestPasswordReset, apiResetPassword, ApiError, type SessionUser } from "@/lib/client/api";

type Portal = "member" | "admin";

/**
 * Forgot password, inside a sign-in card: email a code, then enter it with a
 * new password. Signing in on success also signs out every other session.
 * Shared by the member sign-in page and /admin.
 */
export function ForgotPassword({
  portal,
  initialEmail,
  onDone,
  onCancel,
}: {
  portal: Portal;
  initialEmail: string;
  onDone: (user: SessionUser) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  const requestCode = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      await apiRequestPasswordReset(email.trim(), portal);
      setSent(true);
      setNotice("If that account exists, we've emailed it a 6-digit reset code.");
    }, "Could not send a code.");
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    void run(async () => onDone(await apiResetPassword(email.trim(), otp.trim(), password, portal)), "Could not reset your password.");
  };

  return (
    <>
      {error && <p className="form-err" role="alert">{error}</p>}
      {notice && <p className="form-ok">{notice}</p>}

      {!sent ? (
        <form className="form" onSubmit={requestCode} noValidate>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input id="fp-email" type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="Your email" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Email me a reset code"}
          </button>
          <button className="linklike auth-switch" type="button" onClick={onCancel}>Back to sign in</button>
        </form>
      ) : (
        <form className="form" onSubmit={reset} noValidate>
          <div className="field">
            <label htmlFor="fp-otp">6-digit code</label>
            <input id="fp-otp" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
              pattern="\d{6}" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }} />
          </div>
          <div className="field">
            <label htmlFor="fp-new">New password</label>
            <input id="fp-new" type="password" autoComplete="new-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="12+ chars, upper, lower, digit" />
          </div>
          <div className="field">
            <label htmlFor="fp-confirm">Repeat new password</label>
            <input id="fp-confirm" type="password" autoComplete="new-password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Set new password & sign in"}
          </button>
          <p className="field-hint">This signs you out on every other device.</p>
          <button className="linklike auth-switch" type="button" onClick={() => requestCode()} disabled={busy}>
            Send a new code
          </button>
          <button className="linklike auth-switch" type="button" onClick={onCancel}>Back to sign in</button>
        </form>
      )}
    </>
  );
}
