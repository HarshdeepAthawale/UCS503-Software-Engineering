"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  apiLogin,
  apiRequestLoginOtp,
  apiVerifyLoginOtp,
  ApiError,
} from "@/lib/client/api";
import { GoogleButton } from "@/components/google-button";
import { TiLogo } from "@/components/ti-logo";
import { AuthShell } from "@/components/auth-shell";

type Mode = "password" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [codeSent, setCodeSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Surface an error passed back by the Google OAuth callback (?error=…).
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(err);
  }, []);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiLogin(email.trim(), password);
      router.push("/opportunities");
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
      const res = await apiRequestLoginOtp(email.trim());
      setCodeSent(true);
      setDevOtp(res.devOtp);
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
      router.push("/opportunities");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCodeSent(false);
    setOtp("");
    setDevOtp(undefined);
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <Link className="brand auth-card-brand" href="/">
          <TiLogo size={28} className="ti-mark" /> Thapar&nbsp;Nexus
        </Link>
        <h1>Welcome back</h1>
        <p className="sub">
          {mode === "password"
            ? "Sign in to track your applications and opportunities."
            : "Alumni & passwordless sign-in — we'll email you a one-time code."}
        </p>

        {error && <p className="form-err" role="alert">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}
        {devOtp && <p className="form-ok">Dev code: <strong>{devOtp}</strong></p>}

        {mode === "password" ? (
          <form className="form" onSubmit={onPassword} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@thapar.edu" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : !codeSent ? (
          <form className="form" onSubmit={onRequestCode} noValidate>
            <div className="field">
              <label htmlFor="cemail">Email</label>
              <input id="cemail" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        ) : (
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
            <button className="btn btn-ghost" type="button" onClick={() => switchMode("code")}>
              ← Use a different email
            </button>
          </form>
        )}

        <GoogleButton />

        <p className="auth-alt" style={{ marginTop: 14 }}>
          {mode === "password" ? (
            <button className="linklike" type="button" onClick={() => switchMode("code")}>
              Sign in with a code instead (alumni)
            </button>
          ) : (
            <button className="linklike" type="button" onClick={() => switchMode("password")}>
              ← Back to password sign-in
            </button>
          )}
        </p>

        <p className="auth-alt">
          New to Nexus? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </AuthShell>
  );
}
