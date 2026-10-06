"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AppNav } from "@/components/app-nav";
import { SignInRequired } from "@/components/sign-in-required";
import { apiGetMyClaim, apiSubmitClaim, ApiError, bootstrapSession, getUser, type AlumniClaim } from "@/lib/client/api";
import { claimStage } from "@/lib/client/alumni";
import { dateLabel } from "@/lib/client/format";

const THIS_YEAR = new Date().getFullYear();

/**
 * An alumnus's verification: submit proof of graduation, see it under review,
 * read why it was not accepted and resubmit, or see that they are verified.
 * Until then the account is read-only (docs/PRD §4.5).
 */
export default function AlumniClaimPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [claim, setClaim] = useState<AlumniClaim | null>(null);
  const [form, setForm] = useState({ rollNo: "", gradYear: "", degree: "", proofUrl: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (ok && getUser()?.role === "ALUMNI") {
        try {
          const c = await apiGetMyClaim();
          setClaim(c);
          if (c) setForm({ rollNo: c.rollNo, gradYear: String(c.gradYear), degree: c.degree, proofUrl: c.proofUrl });
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Could not load your claim.");
        }
      }
      setReady(true);
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setClaim(
        await apiSubmitClaim({
          rollNo: form.rollNo.trim(),
          gradYear: Number(form.gradYear),
          degree: form.degree.trim(),
          proofUrl: form.proofUrl.trim(),
        }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your claim.");
    } finally {
      setBusy(false);
    }
  }

  if (ready && !signedIn) return <SignInRequired message="Sign in to see your alumni verification." />;

  const me = getUser();
  const stage = claimStage(claim);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <div className="page-title-row">
            <div>
              <h1>Alumni verification</h1>
              <p className="sub">Your institute email ended when you graduated, so an admin checks your proof of graduation instead.</p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready ? (
            <div className="skeleton skeleton-card" aria-busy="true" />
          ) : me?.role !== "ALUMNI" ? (
            <div className="empty-card">
              <h3>This page is for alumni accounts</h3>
              <Link className="btn btn-ghost" href="/opportunities">Go to opportunities</Link>
            </div>
          ) : (
            <>
              <ol className="claim-steps" aria-label="Verification steps">
                <li className="is-done">Email confirmed</li>
                <li className={stage === "form" || stage === "rejected" ? "is-current" : "is-done"}>
                  {stage === "form" || stage === "rejected" ? "Submit proof" : "Proof submitted"}
                </li>
                <li className={stage === "approved" ? "is-done" : stage === "review" ? "is-current" : ""}>
                  {stage === "approved" ? "Verified by an admin" : "Admin review"}
                </li>
              </ol>

              {stage === "approved" && (
                <section className="card claim-status is-approved">
                  <h2>You're a verified alumnus</h2>
                  <p>You can post opportunities for students and attest their skills.</p>
                  <div className="row-actions">
                    <Link className="btn btn-primary" href="/opportunities/new">Post an opportunity</Link>
                    <Link className="btn btn-ghost" href="/profile">Complete your profile</Link>
                  </div>
                </section>
              )}

              {stage === "review" && claim && (
                <section className="card claim-status">
                  <h2>Your claim is being reviewed</h2>
                  <p>
                    Submitted {dateLabel(claim.updatedAt)}. An admin will check it against institute records. We'll email you
                    the outcome. Until then you can browse, but not post or message.
                  </p>
                  <dl className="claim-facts">
                    <div><dt>Roll number</dt><dd>{claim.rollNo}</dd></div>
                    <div><dt>Graduated</dt><dd>{claim.gradYear}</dd></div>
                    <div><dt>Degree</dt><dd>{claim.degree}</dd></div>
                    <div><dt>Proof</dt><dd><a href={claim.proofUrl} target="_blank" rel="noopener noreferrer">Open link</a></dd></div>
                  </dl>
                  <Link className="btn btn-ghost" href="/opportunities">Browse opportunities</Link>
                </section>
              )}

              {stage === "rejected" && claim && (
                <section className="card claim-status is-rejected" role="status">
                  <h2>Your claim needs a change</h2>
                  <p><strong>Reason:</strong> {claim.decisionReason ?? "Not given."}</p>
                  <p>Correct the details or the proof below and submit again.</p>
                </section>
              )}

              {(stage === "form" || stage === "rejected") && (
                <form className="card section-card" onSubmit={(e) => void submit(e)} noValidate>
                  <header>
                    <h2>{stage === "rejected" ? "Submit again" : "Proof of graduation"}</h2>
                    <p>One link is enough: a degree certificate, a final transcript, or a LinkedIn profile that shows Thapar.</p>
                  </header>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="roll">Roll number</label>
                      <input id="roll" required value={form.rollNo} onChange={set("rollNo")} maxLength={30} autoComplete="off" />
                    </div>
                    <div className="field">
                      <label htmlFor="year">Graduation year</label>
                      <input id="year" type="number" inputMode="numeric" required min={1960} max={THIS_YEAR}
                        value={form.gradYear} onChange={set("gradYear")} placeholder={String(THIS_YEAR - 1)} />
                    </div>
                    <div className="field span-2">
                      <label htmlFor="degree">Degree</label>
                      <input id="degree" required value={form.degree} onChange={set("degree")} maxLength={120}
                        placeholder="e.g. B.E. Computer Engineering" />
                    </div>
                    <div className="field span-2">
                      <label htmlFor="proof">Proof link</label>
                      <input id="proof" type="url" required value={form.proofUrl} onChange={set("proofUrl")} maxLength={500}
                        placeholder="https://" />
                      <p className="field-hint">Make sure the link opens without signing in, or the admin can't check it.</p>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      {busy ? "Submitting…" : stage === "rejected" ? "Submit again" : "Submit for review"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
