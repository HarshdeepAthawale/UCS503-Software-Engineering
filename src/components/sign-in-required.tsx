import Link from "next/link";
import type { ReactNode } from "react";

/** Centered gate when a signed-in session is required. */
export function SignInRequired({
  message = "Sign in to continue.",
  children,
}: {
  message?: string;
  children?: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-card auth-gate">
        <h1>Sign in required</h1>
        <p className="sub">{message}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/login">Sign in</Link>
          {children}
        </div>
      </div>
    </main>
  );
}
