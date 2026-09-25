"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ApplicationCard } from "@/components/application-card";
import { SignInRequired } from "@/components/sign-in-required";
import {
  apiApplicationTracker,
  bootstrapSession,
  getUser,
  type ApplicationBudget,
  type MyApplication,
} from "@/lib/client/api";
import { isActive } from "@/lib/client/application-progress";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";

/**
 * The student's application tracker: every application with its progress
 * from Applied to a decision, open ones first, and how much of the
 * application budget is in use.
 */
export default function ApplicationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [budget, setBudget] = useState<ApplicationBudget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (ok) {
        try {
          const res = await apiApplicationTracker();
          setApps(res.applications);
          setBudget(res.budget);
        } catch (err) {
          if (!handleLoadError(router, err)) setError(loadErrorMessage(err, "Could not load your applications."));
        }
      }
      setReady(true);
    })();
  }, [router]);

  if (ready && !signedIn) {
    return (
      <SignInRequired message="Sign in to track your applications.">
        <Link className="btn btn-ghost" href="/register">Create account</Link>
      </SignInRequired>
    );
  }

  const open = apps.filter((a) => isActive(a.status));
  const decided = apps.filter((a) => !isActive(a.status));
  const full = budget ? budget.active >= budget.limit : false;

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <div className="page-title-row">
            <div>
              <h1>Applications</h1>
              <p className="sub">Every application, from the day you applied to a decision.</p>
            </div>
            {budget && (
              <div className={`budget${full ? " is-full" : ""}`} title="Withdrawing an open application frees a slot">
                <strong>{budget.active} of {budget.limit}</strong>
                <span>open applications</span>
              </div>
            )}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready ? (
            <div className="page-stack" aria-busy="true">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          ) : apps.length === 0 ? (
            <div className="empty-card">
              <h3>No applications yet</h3>
              <p>Apply to an opportunity and you can follow it here, step by step, until you get an answer.</p>
              <Link className="btn btn-primary" href="/opportunities">Find opportunities</Link>
            </div>
          ) : (
            <>
              {full && (
                <p className="form-ok">
                  You have reached your limit of {budget?.limit} open applications. Withdraw one to apply somewhere new.
                </p>
              )}
              {open.length > 0 && (
                <section aria-labelledby="open-apps">
                  <div className="block-head">
                    <h2 id="open-apps">In progress</h2>
                    <span className="block-count">{open.length}</span>
                  </div>
                  <div className="page-stack stack-tight">
                    {open.map((a) => <ApplicationCard key={a.id} app={a} />)}
                  </div>
                </section>
              )}
              {decided.length > 0 && (
                <section aria-labelledby="decided-apps">
                  <div className="block-head">
                    <h2 id="decided-apps">Decided</h2>
                    <span className="block-count">{decided.length}</span>
                  </div>
                  <div className="page-stack stack-tight">
                    {decided.map((a) => <ApplicationCard key={a.id} app={a} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
