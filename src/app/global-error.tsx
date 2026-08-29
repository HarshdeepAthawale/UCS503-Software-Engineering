"use client";

/**
 * Last-resort boundary: catches errors thrown by the ROOT LAYOUT itself, which
 * `error.tsx` sits inside and therefore cannot handle.
 *
 * Because it replaces the root layout, it must render its own <html> and <body>
 * — and it cannot rely on anything the layout provides. The font variables and
 * the pre-paint theme stamp both live in the layout that just failed, so this
 * page carries inline styles rather than the design-system classes: a stylesheet
 * that may not have loaded is exactly the kind of failure that lands here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#faf9f7",
          color: "#1a1a1a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px" }}>
            Nexus is temporarily unavailable
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5a5a5a", margin: "0 0 20px" }}>
            The application failed to start. This is on our side, not yours.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 20px" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontSize: 14,
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #b43a1e",
              background: "#b43a1e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
