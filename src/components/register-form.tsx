"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRegister, apiRegisterAlumni, apiVerifyOtp, ApiError } from "@/lib/client/api";
import { GoogleButton, googleEnabled } from "@/components/google-button";
import { TiLogo } from "@/components/ti-logo";
import { AuthShell } from "@/components/auth-shell";

type Stage = "form" | "otp";

const COPY = {
  student: {
    title: "Create your account",
    sub: "Registration is restricted to @thapar.edu addresses.",
    emailLabel: "Institute email",
    emailPlaceholder: "you@thapar.edu",
  },
  alumni: {
    title: "Register as an alumnus",
    sub: "Use a personal email. After you confirm it, you'll submit proof of graduation for an admin to verify.",
    emailLabel: "Personal email",
    emailPlaceholder: "name@gmail.com",
  },
} as const;

/**
 * Account registration with an emailed code, for students (institute email,
 * or Google) and for alumni (any email - they lost their institute address;
 * an admin verifies their claim afterwards, docs/PRD §4.5).
 */
export function RegisterForm({ kind }: { kind: "student" | "alumni" }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const send = kind === "alumni" ? apiRegisterAlumni : apiRegister;
      const result = await send(name.trim(), email.trim(), password);
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
      router.push(kind === "alumni" ? "/alumni" : "/profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <TiLogo size={48} className="auth-logo" priority />
        <p className="auth-eyebrow">Opportunities Portal</p>
        <h1>{stage === "form" ? copy.title : "Verify your email"}</h1>
        <p className="sub">{stage === "form" ? copy.sub : "Enter the 6-digit code we sent to your inbox."}</p>

        {error && <p className="form-err" role="alert">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}

        {stage === "form" && kind === "student" && googleEnabled && (
          <>
            <GoogleButton label="Sign up with Google" />
            <p className="auth-note">Only @thapar.edu accounts can sign in with Google.</p>
            <div className="or-divider"><span>or register with email</span></div>
          </>
        )}

        {stage === "form" ? (
          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" autoComplete="name" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="field">
              <label htmlFor="email">{copy.emailLabel}</label>
              <input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder={copy.emailPlaceholder} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="new-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="12+ chars, upper, lower, digit" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending code…" : "Continue"}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={onVerify} noValidate>
            <div className="field">
              <label htmlFor="otp">6-digit code</label>
              <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                pattern="\d{6}" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Verifying…" : kind === "alumni" ? "Verify & continue" : "Verify & sign in"}
            </button>
            <button className="btn btn-ghost" type="button"
              onClick={() => { setStage("form"); setNotice(null); setError(null); }}>
              ← Change email
            </button>
          </form>
        )}

        <div className="auth-foot">
          <span className="auth-foot-text">Already have an account?</span>
          <Link className="btn btn-ghost" href="/">Sign in</Link>
        </div>
        {stage === "form" && (
          <p className="auth-alt">
            {kind === "student" ? (
              <>Graduated from Thapar? <Link href="/register/alumni">Register as an alumnus</Link></>
            ) : (
              <>Current student? <Link href="/register">Register with your institute email</Link></>
            )}
          </p>
        )}
      </div>
    </AuthShell>
  );
}
