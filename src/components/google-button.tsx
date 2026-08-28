"use client";

/**
 * "Continue with Google" — a full-page navigation (not fetch) to the OAuth start
 * route, so the browser follows Google's redirects. Rendered only when Google is
 * enabled for this deployment (NEXT_PUBLIC_GOOGLE_ENABLED), so it never dangles.
 */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const enabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
  if (!enabled) return null;

  return (
    <>
      <div className="or-divider"><span>or</span></div>
      <a className="btn btn-ghost google-btn" href="/api/auth/google/start">
        {/* Monochrome Google glyph — inherits currentColor to match the B&W system. */}
        <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
          <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" opacity=".8" />
          <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" opacity=".6" />
          <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" opacity=".9" />
        </svg>
        {label}
      </a>
    </>
  );
}
