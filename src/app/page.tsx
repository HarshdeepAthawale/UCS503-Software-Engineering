"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  apiLogin,
  apiRequestLoginOtp,
  apiVerifyLoginOtp,
  ApiError,
  bootstrapSession,
  getUser,
} from "@/lib/client/api";
import { homeFor } from "@/lib/client/nav";
import { GoogleButton, googleEnabled } from "@/components/google-button";
import { TiLogo } from "@/components/ti-logo";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPassword } from "@/components/forgot-password";

/**
 * The site's front door: sign-in is the root page, like exams.thapar.edu.
 * Google is the primary path for institute accounts; email + password and the
 * emailed one-time code (alumni) sit one click behind "Sign in with email".
 */
type View = "google" | "password" | "code" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>(googleEnabled ? "google" : "password");
  const [codeSent, setCodeSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Surface an error passed back by the Google OAuth callback (?error=…).
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(err);
  }, []);

  // Anyone already signed in goes straight in - admins to their console.
  useEffect(() => {
    void bootstrapSession().then((signedIn) => {
      if (!signedIn) return;
      const user = getUser();
      router.replace(homeFor(user));
    });
  }, [router]);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiLogin(email.trim(), password);
      router.push(homeFor(getUser()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRequestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequestLoginOtp(email.trim());
      setCodeSent(true);
      setNotice("If that account exists, a sign-in code has been sent to your email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiVerifyLoginOtp(email.trim(), otp.trim());
      router.push(homeFor(getUser()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  function go(next: View) {
    setView(next);
    setError(null);
    setNotice(null);
    setCodeSent(false);
    setOtp("");
  }

  const subtitle = {
    google: "Sign in with your institute Google account to continue.",
    password: "Sign in with your email and password.",
    reset: "Choose a new password. We'll email you a code to confirm it's you.",
    code: "We'll email you a one-time sign-in code.",
  }[view];

  return (
    <AuthShell>
      <div className="auth-card">
        <TiLogo size={48} className="auth-logo" priority />
        <p className="auth-eyebrow">Opportunities Portal</p>
        <h1>Thapar Nexus</h1>
        <p className="sub">{subtitle}</p>

        {error && <p className="form-err" role="alert">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}

        {view === "google" && (
          <>
            <GoogleButton />
            <p className="auth-note">Only @thapar.edu accounts can sign in with Google.</p>
          </>
        )}

        {view === "password" && (
          <form className="form" onSubmit={onPassword} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button className="linklike auth-switch" type="button" onClick={() => go("reset")}>
              Forgot password?
            </button>
            <button className="linklike auth-switch" type="button" onClick={() => go("code")}>
              Email me a sign-in code instead
            </button>
          </form>
        )}

        {view === "reset" && (
          <ForgotPassword portal="member" initialEmail={email} onDone={(u) => router.push(homeFor(u))} onCancel={() => go("password")} />
        )}

        {view === "code" && !codeSent && (
          <form className="form" onSubmit={onRequestCode} noValidate>
            <div className="field">
              <label htmlFor="cemail">Email</label>
              <input id="cemail" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <button className="linklike auth-switch" type="button" onClick={() => go("password")}>
              Use a password instead
            </button>
          </form>
        )}

        {view === "code" && codeSent && (
          <form className="form" onSubmit={onVerifyCode} noValidate>
            <div className="field">
              <label htmlFor="cotp">6-digit code</label>
              <input id="cotp" type="text" inputMode="numeric" autoComplete="one-time-code" required
                maxLength={6} pattern="\d{6}" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <button className="linklike auth-switch" type="button" onClick={() => go("code")}>
              Use a different email
            </button>
          </form>
        )}

        <div className="auth-foot">
          {view === "google" ? (
            <button className="btn btn-ghost" type="button" onClick={() => go("password")}>
              Sign in with email
            </button>
          ) : googleEnabled ? (
            <button className="btn btn-ghost" type="button" onClick={() => go("google")}>
              ← Google sign-in
            </button>
          ) : (
            <span />
          )}
          <Link className="btn btn-ghost" href="/register">Create account</Link>
        </div>
        <p className="auth-alt">
          Graduated from Thapar? <Link href="/register/alumni">Register as an alumnus</Link>
        </p>
      </div>
    </AuthShell>
  );
}
