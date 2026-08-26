"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRegister, apiVerifyOtp, ApiError } from "@/lib/client/api";

type Stage = "form" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiRegister(name.trim(), email.trim(), password);
      setDevOtp(result.devOtp);
      setNotice(result.message);
      setStage("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiVerifyOtp(email.trim(), otp.trim());
      router.push("/profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/">
          <span className="mark">N</span> Thapar&nbsp;Nexus
        </Link>
        <h1>{stage === "form" ? "Create your account" : "Verify your email"}</h1>
        <p className="sub">
          {stage === "form"
            ? "Registration is restricted to @thapar.edu addresses."
            : "Enter the 6-digit code we sent to your inbox."}
        </p>

        {error && <p className="form-err" role="alert">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}
        {devOtp && <p className="hint">Dev code (email not configured): {devOtp}</p>}

        {stage === "form" ? (
          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Institute email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@thapar.edu"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="12+ chars, upper, lower, digit"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending code…" : "Continue"}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={onVerify} noValidate>
            <div className="field">
              <label htmlFor="otp">6-digit code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                pattern="\d{6}"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setStage("form");
                setNotice(null);
                setDevOtp(undefined);
                setError(null);
              }}
            >
              ← Change email
            </button>
          </form>
        )}

        <p className="auth-alt">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
