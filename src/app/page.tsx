/**
 * Placeholder home route for Phase 1. The full warm-dark editorial landing page
 * (see docs/Design.md) is wired up in a later UI phase; Phase 1 focuses on the
 * identity & IAM backend.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", maxWidth: 640 }}>
      <h1 style={{ letterSpacing: "-0.02em" }}>Thapar Nexus</h1>
      <p style={{ color: "#555" }}>
        Phase 1 — Identity &amp; IAM foundation is live. The API is under{" "}
        <code>/api</code>. See <code>docs/</code> for the full specification.
      </p>
    </main>
  );
}
